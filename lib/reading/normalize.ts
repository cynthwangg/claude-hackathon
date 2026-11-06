import { fold } from "../norm";
import type { ReadFact, ReadResult, Reading } from "./schema";

type F = { value: string | null; original_text: string | null; page: number | null } | null | undefined;

const ISO = /^\d{4}(-\d{2}(-\d{2})?)?$/;
export const isoOrNull = (v: string | null | undefined) => (v && ISO.test(v.trim()) ? v.trim() : null);

/** Code, not the model, decides the report type from the printed words. */
export function reportTypeFrom(printed: string | null | undefined): "course_by_course" | "document_by_document" | "other" | null {
  if (!printed) return null;
  const t = fold(printed);
  if (/course[\s-]*by[\s-]*course|detailed|curso por curso|逐门/.test(t)) return "course_by_course";
  if (/document[\s-]*by[\s-]*document|general|basic|summary|documento por documento/.test(t)) return "document_by_document";
  return "other";
}

export function toFacts(r: Reading): ReadResult {
  const facts: ReadFact[] = [];
  const add = (key: string, f: F, opts: { date?: boolean } = {}) => {
    if (!f || f.value == null || f.value === "") return;
    const value = opts.date ? isoOrNull(f.value) : f.value.trim();
    if (value == null) return;
    facts.push({ key, value, original_text: f.original_text ?? null, page: f.page ?? null });
  };
  const flag = (key: string, original: string | null, page: number | null = 1) => facts.push({ key, value: true, original_text: original, page });

  switch (r.kind) {
    case "transcript": {
      const t = r.transcript;
      flag("transcript.present", r.document_title?.original_text ?? null, r.document_title?.page ?? 1);
      if (!t) break;
      add("transcript.institution", t.institution);
      add("transcript.student_name", r.holder_name);
      add("transcript.program_name", t.program_name);
      add("transcript.plan", t.plan_or_curriculum);
      add("transcript.start_date", t.start_date, { date: true });
      add("transcript.end_date", t.end_date, { date: true });
      add("transcript.issue_date", t.issue_date, { date: true });
      add("transcript.grading_scale", t.grading_scale);
      add("transcript.overall_average", t.overall_average);
      add("transcript.issuing_office", t.issuing_office);
      if (t.courses.length) {
        facts.push({ key: "transcript.course_names", value: t.courses.map((c) => c.name.trim()), original_text: null, page: t.courses[0]?.page ?? null });
        facts.push({ key: "transcript.courses", value: t.courses, original_text: null, page: null });
      }
      break;
    }
    case "degree":
      flag("degree.present", r.document_title?.original_text ?? null);
      add("degree.title", r.degree?.title);
      add("degree.institution", r.degree?.institution);
      add("degree.date", r.degree?.date, { date: true });
      add("degree.holder_name", r.holder_name);
      break;
    case "license":
      flag("license.present", r.document_title?.original_text ?? null);
      add("license.profession_title", r.license?.profession_title);
      add("license.issuer", r.license?.issuer);
      add("license.year", r.license?.year);
      add("license.country", r.license?.country);
      add("license.holder_name", r.holder_name);
      break;
    case "evaluation_report": {
      const e = r.evaluation;
      flag("evaluation.present", r.document_title?.original_text ?? null);
      if (!e) break;
      add("evaluation.agency_name", e.agency_name);
      add("evaluation.report_date", e.report_date, { date: true });
      const type = reportTypeFrom(e.report_type_printed?.original_text ?? e.report_type_printed?.value);
      if (type) facts.push({ key: "evaluation.report_type", value: type, original_text: e.report_type_printed?.original_text ?? null, page: e.report_type_printed?.page ?? null });
      add("evaluation.us_equivalency_statement", e.us_equivalency_statement);
      facts.push({ key: "evaluation.lists_courses", value: e.lists_courses, original_text: null, page: null });
      facts.push({ key: "evaluation.documents_reviewed", value: e.documents_reviewed, original_text: null, page: null });
      const st = e.student_teaching_text;
      facts.push({ key: "evaluation.mentions_student_teaching", value: !!(st && st.original_text), original_text: st?.original_text ?? null, page: st?.page ?? null });
      break;
    }
    case "ctc_letter": {
      const l = r.ctc_letter;
      flag("ctc_letter.present", r.document_title?.original_text ?? null);
      if (!l) break;
      add("ctc_letter.date", l.date, { date: true });
      add("ctc_letter.subject", l.subject);
      add("ctc_letter.application_title", l.application_title);
      if (l.items.length) facts.push({ key: "ctc_letter.items", value: l.items, original_text: l.items.map((i) => `${i.number}. ${i.text}`).join(" "), page: 1 });
      if (l.deadline_days != null) facts.push({ key: "ctc_letter.deadline_days", value: l.deadline_days, original_text: l.deadline_text?.original_text ?? null, page: l.deadline_text?.page ?? null });
      if (l.attach_letter_text?.original_text) facts.push({ key: "ctc_letter.must_attach_letter", value: true, original_text: l.attach_letter_text.original_text, page: l.attach_letter_text.page });
      break;
    }
    case "experience":
    case "practicum_record":
      flag(`${r.kind}.present`, r.document_title?.original_text ?? null);
      add(`${r.kind}.role`, r.experience?.role);
      add(`${r.kind}.school`, r.experience?.school);
      add(`${r.kind}.start`, r.experience?.start, { date: true });
      add(`${r.kind}.end`, r.experience?.end, { date: true });
      add(`${r.kind}.grades`, r.experience?.grades);
      break;
    case "other":
      flag("other.present", r.document_title?.original_text ?? null);
      add("other.title", r.document_title);
      break;
  }
  r.other_fields.slice(0, 12).forEach((o, i) => facts.push({ key: `${r.kind === "other" ? "other" : r.kind}.extra.${i}`, value: `${o.label} · ${o.value}`, original_text: o.original_text, page: o.page }));
  const raw = r.embedded_instructions.length ? JSON.stringify({ embedded_instructions: r.embedded_instructions }) : null;
  return { kind: r.kind, language: r.language, facts, raw_text: raw, page_count: r.page_count };
}
