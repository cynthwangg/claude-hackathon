import { fold } from "../norm";
import type { FieldKey, ReadFact, ReadResult, Reading } from "./schema";

const ISO = /^\d{4}(-\d{2}(-\d{2})?)?$/;
export const isoOrNull = (v: string | null | undefined) => (v && ISO.test(v.trim()) ? v.trim() : null);

/** Code, not the model, decides the report type from the printed words. */
export function reportTypeFrom(printed: string | null | undefined): "course_by_course" | "document_by_document" | null {
  if (!printed) return null;
  const t = fold(printed);
  if (/course[\s-]*by[\s-]*course|detailed|curso por curso|逐门/.test(t)) return "course_by_course";
  if (/document[\s-]*by[\s-]*document|general report|basic|summary|documento por documento/.test(t)) return "document_by_document";
  // Unrecognized words are not a report type. R01 stays unknown rather than asserting something we did not read.
  return null;
}

const DATE_KEYS: FieldKey[] = ["start_date", "end_date", "issue_date", "degree_date", "report_date", "letter_date"];

/** Which printed field becomes which fact, per document kind. Anything unmapped is dropped, not guessed. */
const MAP: Record<string, Partial<Record<FieldKey, string>>> = {
  transcript: { institution: "transcript.institution", holder_name: "transcript.student_name", program_name: "transcript.program_name", plan_or_curriculum: "transcript.plan", start_date: "transcript.start_date", end_date: "transcript.end_date", issue_date: "transcript.issue_date", grading_scale: "transcript.grading_scale", overall_average: "transcript.overall_average", issuing_office: "transcript.issuing_office" },
  degree: { degree_title: "degree.title", program_name: "degree.title", institution: "degree.institution", degree_date: "degree.date", issue_date: "degree.date", holder_name: "degree.holder_name" },
  license: { license_title: "license.profession_title", license_issuer: "license.issuer", license_year: "license.year", country: "license.country", holder_name: "license.holder_name" },
  evaluation_report: { agency_name: "evaluation.agency_name", report_date: "evaluation.report_date", us_equivalency_statement: "evaluation.us_equivalency_statement" },
  ctc_letter: { letter_date: "ctc_letter.date", letter_subject: "ctc_letter.subject", application_title: "ctc_letter.application_title" },
  experience: { role: "experience.role", school: "experience.school", start_date: "experience.start", end_date: "experience.end", grades: "experience.grades" },
  practicum_record: { role: "practicum_record.role", school: "practicum_record.school", start_date: "practicum_record.start", end_date: "practicum_record.end", grades: "practicum_record.grades" },
  other: { document_title: "other.title" },
};

export function toFacts(r: Reading): ReadResult {
  const facts: ReadFact[] = [];
  const field = (k: FieldKey) => r.fields.find((f) => f.key === k && f.value.trim() !== "");
  const title = field("document_title");
  const page = (p: number) => (p > 0 ? p : null);
  facts.push({ key: `${r.kind === "evaluation_report" ? "evaluation" : r.kind}.present`, value: true, original_text: title?.original_text ?? null, page: title ? page(title.page) : 1 });

  const map = MAP[r.kind] ?? {};
  const seen = new Set<string>();
  for (const f of r.fields) {
    const key = map[f.key];
    if (!key || seen.has(key) || !f.value.trim()) continue;
    const value = DATE_KEYS.includes(f.key) ? isoOrNull(f.value) : f.value.trim();
    if (value === null) continue;
    seen.add(key);
    facts.push({ key, value, original_text: f.original_text || null, page: page(f.page) });
  }

  if (r.kind === "transcript" && r.courses.length) {
    const courses = r.courses.map((c) => ({ name: c.name.trim(), semester: c.semester.trim() || null }));
    facts.push({ key: "transcript.course_names", value: courses.map((c) => c.name), original_text: null, page: page(r.courses[0].page) });
    facts.push({ key: "transcript.courses", value: courses, original_text: null, page: null });
  }

  if (r.kind === "evaluation_report") {
    const printed = field("report_type_printed");
    const type = reportTypeFrom(printed?.original_text || printed?.value);
    if (type) facts.push({ key: "evaluation.report_type", value: type, original_text: printed?.original_text ?? null, page: printed ? page(printed.page) : null });
    facts.push({ key: "evaluation.lists_courses", value: r.lists_courses, original_text: null, page: null });
    facts.push({ key: "evaluation.documents_reviewed", value: r.documents_reviewed, original_text: null, page: null });
    const st = field("student_teaching_text");
    facts.push({ key: "evaluation.mentions_student_teaching", value: !!st, original_text: st?.original_text ?? null, page: st ? page(st.page) : null });
  }

  if (r.kind === "ctc_letter") {
    if (r.letter_items.length) facts.push({ key: "ctc_letter.items", value: r.letter_items, original_text: r.letter_items.map((i) => `${i.number}. ${i.text}`).join(" "), page: 1 });
    const dl = field("deadline_text");
    if (r.deadline_days > 0) facts.push({ key: "ctc_letter.deadline_days", value: r.deadline_days, original_text: dl?.original_text ?? null, page: dl ? page(dl.page) : null });
    const attach = field("attach_letter_text");
    if (attach) facts.push({ key: "ctc_letter.must_attach_letter", value: true, original_text: attach.original_text, page: page(attach.page) });
  }

  r.other.slice(0, 12).forEach((o, i) => facts.push({ key: `${r.kind === "evaluation_report" ? "evaluation" : r.kind}.extra.${i}`, value: `${o.label} · ${o.value}`, original_text: o.original_text || null, page: page(o.page) }));
  const raw = r.embedded_instructions.length ? JSON.stringify({ embedded_instructions: r.embedded_instructions }) : null;
  return { kind: r.kind, language: r.language, facts, raw_text: raw, page_count: null };
}
