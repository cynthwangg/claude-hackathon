import type { FactRow } from "./facts";
import { fold } from "./norm";

/**
 * Section 36.4. The only door out of a case. Every payload that reaches another person, a group or a public page
 * is built here from this table, and nothing else about her can be added on the way.
 */
export type ShareSource = {
  program_id: string | null;
  metro: string | null;
  first_name: string | null;
  phone: string | null;
  counted: boolean;
  years_experience: number | null;
  level: string | null;
  profession: string | null;
};

export type ExportKind = "circle_count" | "introduction" | "gap_post";

export type Exported =
  | { kind: "circle_count"; program_id: string; metro: string }
  | { kind: "introduction"; first_name: string; phone: string }
  | { kind: "gap_post"; first_name: string | null; years_experience: number | null; level: string | null; profession: string | null };

/** Null means nothing may leave for this purpose. Introductions additionally need both sides' INTRO (lib/circle.ts). */
export function exportable(kind: ExportKind, s: ShareSource): Exported | null {
  if (kind === "circle_count") return s.counted && s.program_id && s.metro ? { kind, program_id: s.program_id, metro: s.metro } : null;
  if (kind === "introduction") return s.counted && s.first_name && s.phone ? { kind, first_name: s.first_name, phone: s.phone } : null;
  return { kind, first_name: s.first_name, years_experience: s.years_experience, level: s.level, profession: s.profession };
}

/**
 * The allowlist test, usable at runtime too. Returns every printed or stated value of her case that appears in a text
 * meant for someone else. Short values (years, single letters) are skipped; they cannot identify anything alone.
 * `publicText` is the registry and rule wording: a course name every graduate of the program shares is not hers.
 */
export function leaks(text: string, rows: FactRow[], publicText: string[] = []): string[] {
  const hay = fold(text);
  const pub = publicText.map(fold);
  const values = rows.flatMap((r) => [r.original_text, ...(Array.isArray(r.value) ? r.value : [r.value])]).filter((v): v is string => typeof v === "string" && v.trim().length >= 6);
  return Array.from(new Set(values.filter((v) => hay.includes(fold(v)) && !pub.some((p) => p.includes(fold(v))))));
}
