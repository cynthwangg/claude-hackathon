import { ruleById } from "@/rules/ctc-ms-foreign";
import type { Lang } from "@/rules/types";
import type { Requirement } from "./engine/evaluate";
import type { FactIndex } from "./facts";
import { fmtDate, has, joinList, t } from "./i18n";

export function vars(lang: Lang, f: FactIndex, req?: Requirement): Record<string, string | number> {
  const named = (f.get<string[]>("transcript.practicum_named") ?? []);
  const program = f.get<string>("transcript.program_name") ?? f.get<string>("degree.title") ?? "";
  return {
    named: compactCourses(lang, named),
    agency: f.get<string>("evaluation.agency_name") ?? "",
    program,
    deadline: fmtDate(lang, (req?.meta?.deadline as string) ?? f.get<string>("ctc_letter.deadline")),
    days: Number(req?.meta?.days_left ?? f.get<number>("ctc_letter.days_left") ?? 0),
    letter: fmtDate(lang, f.get<string>("ctc_letter.date")),
  };
}

/** "Trabajo Docente I", "Trabajo Docente II" stay as printed and are joined in her language. */
export function compactCourses(lang: Lang, names: string[]) {
  return joinList(lang, names);
}

export function requirementText(lang: Lang, r: Requirement, f: FactIndex): string {
  const rule = ruleById(r.rule_id);
  const v = vars(lang, f, r);
  const satisfied = r.state === "official" || r.state === "checked" || r.state === "from_document";
  const keys = satisfied
    ? [`req.${r.rule_id}.have`]
    : r.state === "missing"
      ? [`req.${r.rule_id}.missing.${r.reason}`, `req.${r.rule_id}.missing`]
      : [`req.${r.rule_id}.unknown.${r.question}`, `req.${r.rule_id}.unknown`];
  const k = keys.find((x) => has(lang, x));
  if (k) return t(lang, k, v);
  return rule.title[lang] ?? rule.title.en;
}

export function stateWord(lang: Lang, r: Requirement, f: FactIndex) {
  if (r.state === "from_document") {
    const fromStatement = r.evidence.length > 0 && r.evidence.every((id) => id.startsWith("stated:") || f.all().find((x) => x.id === id)?.source === "statement");
    if (fromStatement) return t(lang, "state.statement");
  }
  return t(lang, `state.${r.state}`);
}

export function experienceYears(f: FactIndex): number | null {
  const s = f.get<string>("experience.start");
  const e = f.get<string>("experience.end");
  if (!s || !e) return null;
  const y = Number(e.slice(0, 4)) - Number(s.slice(0, 4));
  return y > 0 ? y : null;
}

const LETTER_PHRASES: [RegExp, string][] = [
  [/student teaching|professional preparation program/i, "R05"],
  [/course[\s-]*by[\s-]*course|general report|detailed/i, "R01"],
  [/approved agency|commission-approved/i, "R02"],
  [/fingerprint|live scan/i, "R09"],
];

export type LetterItem = { number: number; text: string; rule_id: string | null };

/** Letter items are matched to rules by a reviewed phrase table, in code. Unmatched items are shown verbatim. */
export function letterItems(f: FactIndex): LetterItem[] {
  const items = f.get<{ number: number; text: string }[]>("ctc_letter.items") ?? [];
  return items.map((it) => ({ number: it.number, text: it.text, rule_id: LETTER_PHRASES.find(([re]) => re.test(it.text))?.[1] ?? null }));
}

export const ruleTitle = (lang: Lang, id: string) => ruleById(id).title[lang] ?? ruleById(id).title.en;
