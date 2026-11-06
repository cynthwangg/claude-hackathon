import evaluators from "@/data/ctc-approved-evaluators.json";
import { ELEMENTARY_WORDS, LICENSE_WORDS, PRACTICUM_CORE, PRACTICUM_SYNONYMS } from "@/rules/ctc-ms-foreign";
import type { FactState } from "@/rules/types";
import { addDays, daysBetween, isoDay, parseDay } from "./clock";
import { containsAny, fold } from "./norm";

export type FactRow = {
  id: string;
  key: string;
  value: unknown;
  original_text: string | null;
  page: number | null;
  state: FactState;
  source: string;
  document_id: string | null;
};

export type Agency = { id: string; name: string; short: string; aliases: string[]; website?: string; order_note?: string; closed_on?: string; note?: string };

const listed = evaluators.agencies as Agency[];
const closed = evaluators.closed as Agency[];

export function matchAgency(name: string): { agency: Agency; closed: boolean } | null {
  const n = fold(name);
  const hit = (a: Agency) =>
    n.includes(fold(a.name).replace(/[.,]/g, "").replace(/ inc$/, "")) ||
    a.aliases.some((al) => new RegExp(`(^|[^a-z])${fold(al).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(n));
  const open = listed.find(hit);
  if (open) return { agency: open, closed: false };
  const shut = closed.find(hit);
  if (shut) return { agency: shut, closed: true };
  return null;
}

export const approvedAgencies = () => listed;

export type DerivedContext = { today: Date; stated: Record<string, unknown>; routeKind?: string };

/** A read-only view over the case's facts plus facts derived by code. */
export class FactIndex {
  private byKey = new Map<string, FactRow[]>();

  constructor(rows: FactRow[], ctx: DerivedContext) {
    for (const r of rows) this.push(r);
    for (const [k, v] of Object.entries(ctx.stated)) {
      if (v === undefined || v === null || v === "") continue;
      if (!this.has(`stated.${k}`)) this.push({ id: `stated:${k}`, key: `stated.${k}`, value: v, original_text: null, page: null, state: "from_document", source: "statement", document_id: null });
    }
    this.derive(ctx);
  }

  private push(r: FactRow) {
    const list = this.byKey.get(r.key) ?? [];
    list.push(r);
    this.byKey.set(r.key, list);
  }

  private derived(key: string, value: unknown, from: string[]) {
    const src = from.flatMap((k) => this.byKey.get(k) ?? []);
    this.push({ id: `derived:${key}`, key, value, original_text: null, page: null, state: bestOf(src.map((s) => s.state)) ?? "from_document", source: "derived", document_id: src[0]?.document_id ?? null });
  }

  private derive(ctx: DerivedContext) {
    // A transcript photographed page by page arrives as several documents; their course lists are combined.
    const courses = Array.from(new Set(this.rows("transcript.course_names").flatMap((r) => (Array.isArray(r.value) ? (r.value as string[]) : []))));
    if (this.has("transcript.present") && courses.length) {
      const practicum = courses.filter((c) => containsAny(c, PRACTICUM_SYNONYMS));
      if (practicum.length) {
        this.derived("transcript.practicum_courses", practicum, ["transcript.course_names"]);
        const core = practicum.filter((c) => containsAny(c, PRACTICUM_CORE) && !/^seminario/i.test(fold(c)));
        this.derived("transcript.practicum_named", core.length ? core : practicum, ["transcript.course_names"]);
      }
    }

    const agencyName = this.get<string>("evaluation.agency_name");
    if (agencyName && !this.has("evaluation.agency_status")) {
      const m = matchAgency(agencyName);
      let status = "not_listed";
      if (m && !m.closed) status = "listed";
      if (m && m.closed) {
        const rd = this.get<string>("evaluation.report_date");
        status = rd && m.agency.closed_on && rd < m.agency.closed_on ? "closed_report_before_closure" : "closed_report_after_closure";
      }
      this.derived("evaluation.agency_status", status, ["evaluation.agency_name"]);
      if (m) this.derived("evaluation.agency_id", m.agency.id, ["evaluation.agency_name"]);
    }

    const reviewed = this.get<string[]>("evaluation.documents_reviewed");
    if (Array.isArray(reviewed)) this.derived("evaluation.includes_license", reviewed.some((d) => containsAny(d, LICENSE_WORDS)), ["evaluation.documents_reviewed"]);

    const program = [this.get<string>("transcript.program_name"), this.get<string>("degree.title"), this.get<string>("evaluation.us_equivalency_statement")].filter(Boolean).join(" ");
    if (program && containsAny(program, ELEMENTARY_WORDS) && ctx.routeKind !== "near") this.derived("program.is_elementary", true, ["transcript.program_name", "degree.title"]);

    const letterDate = this.get<string>("ctc_letter.date");
    if (letterDate) {
      const deadline = deadlineFor(letterDate);
      const daysLeft = daysBetween(ctx.today, deadline);
      this.derived("ctc_letter.deadline", isoDay(deadline), ["ctc_letter.date"]);
      this.derived("ctc_letter.days_left", daysLeft, ["ctc_letter.date"]);
      this.derived("ctc_letter.deadline_passed", daysLeft < 0, ["ctc_letter.date"]);
    }
  }

  has(key: string) {
    return (this.byKey.get(key)?.length ?? 0) > 0;
  }

  get<T = unknown>(key: string): T | undefined {
    const list = this.byKey.get(key);
    return list && list.length ? (list[list.length - 1].value as T) : undefined;
  }

  rows(key: string) {
    return this.byKey.get(key) ?? [];
  }

  idsFor(keys: string[]) {
    return keys.flatMap((k) => this.rows(k).map((r) => r.id));
  }

  bestStateFor(keys: string[]): FactState {
    return bestOf(keys.flatMap((k) => this.rows(k).map((r) => r.state))) ?? "from_document";
  }

  officialDecisionFor(ruleId: string) {
    const v = this.get<string[]>("ctc_decision.satisfied");
    return Array.isArray(v) && v.includes(ruleId);
  }

  all() {
    return [...this.byKey.values()].flat();
  }
}

const rank: Record<FactState, number> = { official: 3, checked: 2, from_document: 1 };
function bestOf(states: FactState[]): FactState | undefined {
  return states.sort((a, b) => rank[b] - rank[a])[0];
}

/** The single place the R21 deadline is computed (D7). 60 days from the letter date, never the extracted number. */
export function deadlineFor(letterDate: string): Date {
  return addDays(parseDay(letterDate), 60);
}
