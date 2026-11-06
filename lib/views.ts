import approved from "@/data/ctc-approved-evaluators.json";
import { generalOrientation } from "@/data/pathways";
import { ruleById } from "@/rules/ctc-ms-foreign";
import type { Lang } from "@/rules/types";
import { today } from "./clock";
import type { LoadedCase } from "./case";
import type { Analysis } from "./engine/analyze";
import type { Requirement } from "./engine/evaluate";
import type { ActionKind, Next } from "./engine/plan";
import type { FactIndex } from "./facts";
import { fmtDate, t } from "./i18n";
import { isMock } from "./model";
import { findOffice } from "./office";
import { db } from "./db";
import type { Authority } from "@/data/authorities";
import { experienceYears, letterItems, requirementText, stateWord, vars } from "./present";

type C = NonNullable<LoadedCase>;
export type Line = { rule_id: string; state: string; state_word: string; text: string };

const line = (lang: Lang, r: Requirement, f: FactIndex): Line => ({ rule_id: r.rule_id, state: r.state, state_word: stateWord(lang, r, f), text: requirementText(lang, r, f) });

/** The office is looked up once per profession and state and saved on the case. */
async function officeFor(c: C): Promise<Authority | null> {
  const key = `${c.intakeObj.profession}:${c.intakeObj.us_state}`;
  const saved = c.office ? (JSON.parse(c.office) as { key: string; office: Authority | null }) : null;
  if (saved && saved.key === key && saved.office) return saved.office;
  const office = await findOffice(c.intakeObj.profession, c.intakeObj.profession_words, c.intakeObj.us_state);
  if (office) await db.case.update({ where: { id: c.id }, data: { office: JSON.stringify({ key, office }) } });
  return office;
}

export async function caseHeader(c: C) {
  const office = await officeFor(c);
  return {
    id: c.id,
    lang: c.lang,
    name: c.intakeObj.first_name ?? c.first_name,
    route_kind: c.routing.kind,
    pathway: c.routing.pathway ? { id: c.routing.pathway.id, title: c.routing.pathway.title[c.lang] ?? c.routing.pathway.title.en, orientation: c.routing.pathway.orientation[c.lang] ?? c.routing.pathway.orientation.en } : null,
    general_orientation: generalOrientation[c.lang] ?? generalOrientation.en,
    office,
    mock: isMock(),
    today: today().toISOString().slice(0, 10),
  };
}

export function positionView(c: C, a: Analysis) {
  const lang = c.lang;
  const f = a.facts;
  const docCount = c.documents.filter((d) => d.status === "read").length;
  let needed = a.buckets.needed;
  let unknown = a.buckets.unknown;
  if (docCount === 0) {
    needed = [...needed, ...unknown];
    unknown = [];
  }
  const years = experienceYears(f) ?? c.intakeObj.years_experience;
  const extraHave: { text: string; state_word: string; note: string | null; rule_id: string | null }[] = [];
  // The practicum she has is shown as hers even while the evaluation that documents it is still needed (6.4).
  const r05 = a.requirements.find((r) => r.rule_id === "R05");
  if (f.has("transcript.practicum_named") && r05 && !["official", "checked", "from_document"].includes(r05.state))
    extraHave.push({ text: t(lang, "req.R05.have", vars(lang, f)), state_word: t(lang, "state.from_document"), note: null, rule_id: "R05" });
  if (f.has("experience.present") && years) extraHave.push({ text: t(lang, "position.experience", { years }), state_word: t(lang, "state.from_document"), note: t(lang, "position.experience_note"), rule_id: null });
  const accepted = c.actions.filter((x) => x.state === "accepted").map((x) => ({ kind: x.kind, statement: !f.officialDecisionFor(JSON.parse(x.rule_ids)[0] ?? "") }));
  return {
    doc_count: docCount,
    have: a.buckets.have.map((r) => line(lang, r, f)),
    extra_have: extraHave,
    needed: needed.map((r) => line(lang, r, f)),
    unknown: unknown.map((r) => line(lang, r, f)),
    later: a.buckets.later.map((r) => ({ rule_id: r.rule_id, text: ruleById(r.rule_id).title[lang] ?? ruleById(r.rule_id).title.en })),
    letter: letterItems(f).map((it) => ({
      ...it,
      paperwork: it.rule_id === "R05" && f.has("transcript.practicum_courses"),
      named: it.rule_id === "R05" ? (f.get<string[]>("transcript.practicum_named") ?? []) : [],
    })),
    accepted,
    transcript_document_id: c.documents.find((d) => d.kind === "transcript" && d.status === "read")?.id ?? null,
    next: weekView(c, a).headline,
  };
}

export function routeView(c: C, a: Analysis) {
  const lang = c.lang;
  const f = a.facts;
  const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
  return {
    title: t(lang, "route.title"),
    steps: a.route.steps.map((s) => ({
      key: s.key,
      rule_id: s.rule_ids[0],
      text: t(lang, s.key),
      state: s.state,
      state_word: s.state === "waiting" ? t(lang, "route.state.waiting") : t(lang, `state.${s.state}`),
      note: s.key === "route.step.respond_letter" && s.meta?.days_left !== undefined && Number(s.meta.days_left) >= 0 ? t(lang, "route.step.respond_letter_days", { days: Number(s.meta.days_left) }) : s.key === "route.step.ctc_reviews" ? t(lang, "route.step.ctc_reviews_note") : null,
    })),
    known: a.route.costs.known.map((k) => ({ rule_id: k.rule_id, text: t(lang, k.label_key), amount: usd(k.amount_cents ?? 0), paid: !!k.paid })),
    paid_note: a.route.costs.known.some((k) => k.paid) ? t(lang, "cost.paid") : null,
    external: a.route.costs.external.map((k) => ({ rule_id: k.rule_id, text: t(lang, k.label_key) })),
    bridge: a.route.bridge,
    blocker: a.route.blocker ? { rule_id: a.route.blocker, text: requirementText(lang, a.requirements.find((r) => r.rule_id === a.route.blocker)!, f) } : null,
  };
}

const ierf = (approved.agencies as { id: string; order_note?: string }[]).find((x) => x.id === "ierf");

export function weekView(c: C, a: Analysis) {
  const lang = c.lang;
  const f = a.facts;
  const n: Next = a.next;
  const v = vars(lang, f);
  const hasLetter = f.has("ctc_letter.date");
  const kindText = (k: ActionKind) => t(lang, `week.${k}`, v);
  const why = (k: ActionKind) => {
    if (k === "request_evaluation") return t(lang, hasLetter ? "week.request_evaluation.why" : "week.request_evaluation.why_noletter");
    if (k === "request_school_letter" && n.report_deferred) return t(lang, "week.request_school_letter.deferred");
    return t(lang, `week.${k}.why`, { ...v, deadline: fmtDate(lang, f.get<string>("ctc_letter.deadline")) });
  };
  const action = (k: ActionKind) => c.actions.find((x) => x.kind === k)?.id ?? null;
  const cost = n.headline === "request_evaluation" ? t(lang, hasLetter && f.has("ctc_letter.present") ? "week.cost.evaluation" : "week.cost.evaluation_noletter") : n.headline === "request_school_letter" || n.headline === "ask_ctc_question" ? t(lang, "week.cost.free") : null;
  const after = ["request_evaluation", "request_school_letter", "ask_ctc_question", "respond_ctc_letter"].includes(n.headline) ? t(lang, `week.after.${n.headline}`) : t(lang, "week.after.generic");
  const ssn = f.get<string>("stated.has_ssn_or_itin");
  return {
    headline: { kind: n.headline, text: kindText(n.headline), why: why(n.headline), action_id: action(n.headline), has_draft: ["request_evaluation", "request_school_letter", "ask_ctc_question", "respond_ctc_letter", "confirm_resubmit"].includes(n.headline) },
    why_now: hasLetter && n.days_left !== undefined && n.days_left >= 0 && n.headline !== "confirm_resubmit" ? t(lang, "week.deadline", { letter: fmtDate(lang, f.get<string>("ctc_letter.date")), days: n.days_left }) : null,
    cost: n.show_cost ? cost : null,
    after,
    before_paying: n.show_before_paying && n.headline === "request_evaluation" ? [t(lang, "week.before_paying.text"), ierf?.order_note ? t(lang, "week.before_paying.ierf") : null].filter(Boolean) : [],
    also: n.also.map((k) => ({ kind: k, text: kindText(k), why: why(k), action_id: action(k), has_draft: ["request_evaluation", "request_school_letter", "ask_ctc_question"].includes(k) })),
    packet: n.headline === "respond_ctc_letter" ? [t(lang, "week.packet.letter", { date: fmtDate(lang, f.get<string>("ctc_letter.date")) }), t(lang, "action.request_evaluation")] : [],
    ssn: n.headline === "respond_ctc_letter" || n.headline === "apply_ctc" || ssn ? { answer: ssn ?? null } : null,
    agency_list: "https://www.ctc.ca.gov/aspiring-educators/transcripts/foreign-transcript-eval/",
  };
}

export function whyView(lang: Lang, ruleId: string, a: Analysis | null, docs: { id: string; kind: string }[]) {
  const rule = ruleById(ruleId);
  const req = a?.requirements.find((r) => r.rule_id === ruleId);
  const f = a?.facts;
  const evidence: { document_id: string | null; kind: string | null; label: string; quote: string | null; page: number | null; statement: boolean }[] = [];
  const seen = new Set<string>();
  const push = (e: (typeof evidence)[number]) => {
    const k = `${e.document_id}|${e.quote ?? e.label}`;
    if (!seen.has(k)) { seen.add(k); evidence.push(e); }
  };
  if (req && f) {
    for (const id of req.evidence) {
      const row = f.all().find((x) => x.id === id);
      if (!row) continue;
      const kind = docs.find((d) => d.id === row.document_id)?.kind ?? null;
      if (row.key === "transcript.practicum_courses" || row.key === "transcript.course_names") {
        for (const name of f.get<string[]>("transcript.practicum_named") ?? []) push({ document_id: row.document_id, kind, label: t(lang, "label.transcript.practicum_courses"), quote: name, page: null, statement: false });
        continue;
      }
      if (row.source === "derived") continue;
      push({ document_id: row.document_id, kind, label: t(lang, `label.${row.key}`), quote: row.original_text ?? (typeof row.value === "string" ? row.value : null), page: row.page, statement: row.source === "statement" || row.id.startsWith("stated:") });
    }
  }
  return {
    rule_id: rule.id,
    asks: rule.title[lang] ?? rule.title.en,
    excerpt: rule.excerpt,
    source_title: rule.source_title,
    source_url: rule.source_url,
    read_on: fmtDate(lang, rule.retrieved_on),
    effective_on: rule.effective_on ?? null,
    evidence,
    decider: rule.decider[lang] ?? rule.decider.en,
    discretion: rule.discretion,
    related: rule.id === "R02" ? ["R03", "P02"] : rule.id === "R01" ? ["P03"] : rule.id === "R21" ? ["P01"] : [],
    state: req?.state ?? null,
  };
}
