import { describe, expect, it } from "vitest";
import { FactIndex, matchAgency, type FactRow } from "@/lib/facts";
import { evaluateAll, evaluateRule } from "@/lib/engine/evaluate";
import { ruleById, rules } from "@/rules/ctc-ms-foreign";
import { TODAY, fact } from "./helpers";

const idx = (rows: FactRow[], stated: Record<string, unknown> = {}, routeKind?: "match" | "near") => new FactIndex(rows, { today: TODAY, stated, routeKind });
const ev = (id: string, rows: FactRow[], stated: Record<string, unknown> = {}) => evaluateRule(ruleById(id), idx(rows, stated));

describe("rule table", () => {
  it("every rule has a verbatim excerpt, a CTC source and a decider", () => {
    for (const r of rules) {
      expect(r.excerpt.length).toBeGreaterThan(30);
      expect(r.source_url).toMatch(/^https:\/\/www\.ctc\.ca\.gov\//);
      expect(r.decider.en.length).toBeGreaterThan(2);
      expect(r.excerpt).not.toMatch(/—/);
    }
    expect(rules.filter((r) => /^R\d\d$/.test(r.id))).toHaveLength(21);
  });
});

describe("one test per rule", () => {
  it("R01 general report is missing, course-by-course satisfies, none is unknown", () => {
    expect(ev("R01", [])).toMatchObject({ state: "unknown", question: "q.have_evaluation" });
    expect(ev("R01", [fact("evaluation.report_type", "document_by_document")])).toMatchObject({ state: "missing", reason: "report_type_general" });
    expect(ev("R01", [fact("evaluation.report_type", "course_by_course")]).state).toBe("from_document");
    expect(ev("R01", [fact("evaluation.report_type", "course_by_course", "checked")]).state).toBe("checked");
  });

  it("R02 matches the approved list and handles closures (P02)", () => {
    expect(ev("R02", [fact("evaluation.agency_name", "Educational Credential Evaluators, Inc.")]).state).toBe("from_document");
    expect(ev("R02", [fact("evaluation.agency_name", "Pacific Credential Review")])).toMatchObject({ state: "missing", reason: "agency_not_on_list" });
    expect(ev("R02", [fact("evaluation.agency_name", "AERC"), fact("evaluation.report_date", "2025-05-01")]).state).toBe("from_document");
    expect(ev("R02", [fact("evaluation.agency_name", "AERC"), fact("evaluation.report_date", "2025-10-01")])).toMatchObject({ state: "missing", reason: "agency_closed" });
    expect(matchAgency("WES Canada")?.agency.id).toBe("wes");
    expect(matchAgency("Certificate Evaluation Company")).toBeNull();
  });

  it("R03 is informational and never bucketed", () => {
    expect(ruleById("R03").kind).toBe("informational");
    expect(evaluateAll(idx([])).find((r) => r.rule_id === "R03")).toBeUndefined();
  });

  it("R04 is capped at from_document and unknown until a course-by-course report states it", () => {
    expect(ev("R04", [fact("degree.present", true)])).toMatchObject({ state: "unknown", question: "q.equivalence_decided_by_agency" });
    expect(ev("R04", [fact("evaluation.report_type", "course_by_course", "checked"), fact("evaluation.us_equivalency_statement", "Bachelor's", "checked")]).state).toBe("from_document");
  });

  it("R05 follows D5: no practicum name is unknown, never missing", () => {
    const transcript = [fact("transcript.present", true), fact("transcript.course_names", ["Matemáticas I", "Trabajo Docente I"])];
    const noPrac = [fact("transcript.present", true), fact("transcript.course_names", ["Matemáticas I"])];
    const general = [fact("evaluation.report_type", "document_by_document"), fact("evaluation.lists_courses", false)];
    expect(ev("R05", transcript).state).toBe("from_document");
    expect(ev("R05", [...transcript, ...general])).toMatchObject({ state: "missing", reason: "evaluation_lists_no_courses" });
    expect(ev("R05", noPrac)).toMatchObject({ state: "unknown", question: "q.practicum_evidence" });
    expect(ev("R05", [...noPrac, ...general])).toMatchObject({ state: "unknown", question: "q.practicum_evidence" });
    expect(ev("R05", [fact("evaluation.report_type", "course_by_course", "checked"), fact("evaluation.mentions_student_teaching", true, "checked")]).state).toBe("from_document");
  });

  it("R05 synonym list matches 教育实习 but not 教育见习", () => {
    const zh = (c: string[]) => ev("R05", [fact("transcript.present", true), fact("transcript.course_names", c)]);
    expect(zh(["教育实习"]).state).toBe("from_document");
    expect(zh(["教育见习"]).state).toBe("unknown");
  });

  it("R06 accepts a license document or her statement", () => {
    expect(ev("R06", [fact("license.present", true)]).state).toBe("from_document");
    expect(ev("R06", [], { has_foreign_license: true }).state).toBe("from_document");
    expect(ev("R06", [], { has_foreign_license: false })).toMatchObject({ state: "missing", reason: "no_foreign_license" });
    expect(ev("R06", []).state).toBe("unknown");
  });

  it("R07 needs the license among documents reviewed", () => {
    expect(ev("R07", [fact("evaluation.report_type", "course_by_course"), fact("evaluation.documents_reviewed", ["Título", "Cédula profesional"])]).state).toBe("from_document");
    expect(ev("R07", [fact("evaluation.report_type", "document_by_document"), fact("evaluation.documents_reviewed", ["Título"])])).toMatchObject({ state: "missing", reason: "license_not_sent_to_agency" });
  });

  it("R08 stays quiet unknown until she confirms originals", () => {
    expect(ev("R08", []).question).toBe("q.none");
    expect(ev("R08", [], { originals_available: true }).state).toBe("from_document");
  });

  it("R09 is Live Scan in California and FD-258 cards outside", () => {
    expect(ev("R09", [], { lives_in_california: true })).toMatchObject({ state: "missing", reason: "live_scan" });
    expect(ev("R09", [], { lives_in_california: false })).toMatchObject({ state: "missing", reason: "fd258_cards" });
  });

  it("R10 is satisfied once a CTC letter shows she applied", () => {
    expect(ev("R10", [fact("ctc_letter.present", true)]).state).toBe("from_document");
    expect(ev("R10", []).state).toBe("missing");
  });

  it("R11 is hard, never stores the number, and prefer-not stays unknown", () => {
    expect(ev("R11", [], { has_ssn_or_itin: "no" })).toMatchObject({ state: "missing", reason: "no_ssn_or_itin" });
    expect(ev("R11", [], { has_ssn_or_itin: "prefer_not" }).state).toBe("unknown");
    expect(ruleById("R11").hard).toBe(true);
  });

  it("R12 reads the program name and is excluded on the near route (F19)", () => {
    expect(ev("R12", [fact("transcript.program_name", "Licenciatura en Educación Primaria")]).state).toBe("from_document");
    const near = evaluateAll(idx([fact("transcript.program_name", "汉语言文学（师范）")], {}, "near"), { routeKind: "near" });
    expect(near.find((r) => r.rule_id === "R12")).toBeUndefined();
  });

  it("R13, R14, R15 never resolve from documents", () => {
    for (const id of ["R13", "R14", "R15"]) expect(ev(id, [fact("transcript.overall_average", "9.1")]).state).toBe("unknown");
  });

  it("R16 to R20 are later, clear credential requirements", () => {
    for (const id of ["R16", "R17", "R18", "R19", "R20"]) {
      expect(ruleById(id).phase).toBe("B");
      expect(ev(id, [])).toMatchObject({ state: "missing", reason: "clear_credential" });
    }
  });

  it("R21 counts 60 days from the letter date, and day 60 is not passed", () => {
    const at = (date: string) => evaluateAll(idx([fact("ctc_letter.present", true), fact("ctc_letter.date", date)])).find((r) => r.rule_id === "R21")!;
    expect(at("2026-10-14")).toMatchObject({ state: "missing", reason: "respond_by", meta: { days_left: 38, deadline: "2026-12-13" } });
    expect(at("2026-09-06")).toMatchObject({ reason: "respond_by", meta: { days_left: 0 } });
    expect(at("2026-08-27").reason).toBe("deadline_passed");
    expect(evaluateAll(idx([])).find((r) => r.rule_id === "R21")!.question).toBe("q.none");
  });

  it("a CTC decision fact makes a rule official", () => {
    expect(ev("R01", [fact("evaluation.report_type", "document_by_document"), fact("ctc_decision.satisfied", ["R01"], "official")]).state).toBe("official");
  });
});

describe("multi-page transcripts", () => {
  it("combines course lists from several transcript uploads", () => {
    const rows = [fact("transcript.present", true), { ...fact("transcript.course_names", ["Matemáticas I"]), id: "p1" }, { ...fact("transcript.course_names", ["Trabajo Docente I"]), id: "p2" }];
    expect(ev("R05", rows).state).toBe("from_document");
  });
});
