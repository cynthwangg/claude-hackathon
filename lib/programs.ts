import { PROGRAMS, type Program } from "@/data/programs";
import { PRACTICUM_SYNONYMS } from "@/rules/ctc-ms-foreign";
import type { FactIndex } from "./facts";
import { containsAny, fold } from "./norm";

const COUNTRY: Record<string, string> = { mexico: "MX", méxico: "MX", china: "CN" };

/** What we know about her before any document, from the intake and her own words. Never inferred by a model. */
export type ProgramHints = { country_of_training?: string | null; text?: string | null; graduation_year?: number | null };

const yearOf = (s: unknown) => (typeof s === "string" ? Number(s.slice(0, 4)) || null : null);

function graduationYear(f: FactIndex | null, h: ProgramHints): number | null {
  const fromDoc = yearOf(f?.get("transcript.end_date")) ?? yearOf(f?.get("degree.date"));
  if (fromDoc) return fromDoc;
  if (h.graduation_year) return h.graduation_year;
  const m = (h.text ?? "").match(/(?:gradu|egres|titul|毕业)\D{0,20}((?:19|20)\d{2})|((?:19|20)\d{2})\s*年?\s*毕业/i);
  return m ? Number(m[1] ?? m[2]) : null;
}

/**
 * Section 30.3. Deterministic. Country, then institution, then program name, then plan or graduation year.
 * A document fact always wins over her words. Two candidates is a tie and returns null, which changes nothing.
 */
export function matchProgram(f: FactIndex | null, h: ProgramHints = {}): Program | null {
  const country = COUNTRY[fold(h.country_of_training ?? "")] ?? null;
  const institution = f?.get<string>("transcript.institution") ?? f?.get<string>("degree.institution") ?? h.text ?? "";
  const programName = f?.get<string>("transcript.program_name") ?? f?.get<string>("degree.title") ?? null;
  const plan = f?.get<string>("transcript.plan") ?? null;
  const year = graduationYear(f, h);

  const hits = PROGRAMS.filter((p) => {
    if (country && p.country !== country) return false;
    if (!institution || !containsAny(institution, p.institution_match)) return false;
    if (programName && !containsAny(programName, p.program_names)) return false;
    if (plan && p.plan_match.length) return p.plan_match.some((x) => fold(plan).includes(fold(x)));
    return year !== null && year >= p.years_in_force[0] && year <= p.years_in_force[1];
  });
  return hits.length === 1 ? hits[0] : null;
}

export type ProgramCheck = {
  rule_id: string;
  fact_key: string;
  expected: string[];
  /** expected: no transcript yet. confirmed: the transcript prints the courses. contradicted: it lists courses but none of these. */
  status: "expected" | "confirmed" | "contradicted";
  found: string[];
};

/** Sections 30.4 and 30.5. The registry never wins over her paper; it only says what to expect and when the paper agrees. */
export function checkProgram(p: Program, f: FactIndex | null): ProgramCheck[] {
  const courses = (f?.rows("transcript.course_names") ?? []).flatMap((r) => (Array.isArray(r.value) ? (r.value as string[]) : []));
  return p.satisfies.map((s) => {
    const expected = s.expected_courses.map((c) => c.name);
    const base = { rule_id: s.rule_id, fact_key: s.fact_key, expected };
    if (!courses.length) return { ...base, status: "expected", found: [] };
    const found = courses.filter((c) => expected.some((e) => fold(c).startsWith(fold(e))));
    if (found.length) return { ...base, status: "confirmed", found };
    const practicum = courses.filter((c) => containsAny(c, PRACTICUM_SYNONYMS));
    return practicum.length ? { ...base, status: "confirmed", found: practicum } : { ...base, status: "contradicted", found: [] };
  });
}

/** Deterministic metro from the city she gave. Used only for circle counts, never shown with anything else. */
const METROS: [RegExp, string][] = [
  [/san jos[eé]|oakland|san francisco|berkeley|fremont|hayward|sunnyvale|santa clara|mountain view|palo alto|redwood city|san mateo|daly city|richmond|concord|milpitas/i, "sf_bay_area"],
  [/los [aá]ngeles|alhambra|pasadena|long beach|glendale|santa ana|anaheim|el monte|pomona|torrance|inglewood/i, "la"],
  [/sacramento|elk grove|roseville/i, "sacramento"],
  [/san diego|chula vista|escondido/i, "san_diego"],
  [/fresno|clovis|visalia/i, "central_valley"],
];

export const metroFor = (city: string | null | undefined) => (city ? (METROS.find(([re]) => re.test(city))?.[1] ?? null) : null);

/** Registry wording every graduate of a program shares. The privacy check (lib/privacy.ts `leaks`) does not count it as hers. */
export const publicText = (programs = PROGRAMS) =>
  programs.flatMap((p) => [p.source.title, ...Object.values(p.short), ...p.program_names, ...p.plan_match.map((x) => `plan ${x}`), ...p.satisfies.flatMap((s) => [s.school_letter.issuing_office, ...s.expected_courses.map((c) => c.name)])]);
