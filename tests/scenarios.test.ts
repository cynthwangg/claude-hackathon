import { describe, expect, it } from "vitest";
import { analyze, applyPatch, diff, type Patch } from "@/lib/engine/analyze";
import type { FactRow } from "@/lib/facts";
import { TODAY, golden, marianaRows, marianaStated } from "./helpers";

const state = (a: ReturnType<typeof analyze>, id: string) => a.requirements.find((r) => r.rule_id === id)!;

function run(rows: FactRow[], stated: Record<string, unknown>, patch: Patch) {
  const base = analyze(rows, stated, TODAY);
  const h = applyPatch(rows, stated, patch);
  const hyp = analyze(h.rows, h.stated, TODAY);
  return { base, hyp, ...diff(base, hyp, stated, h.stated) };
}
const changed = (d: { delta: { rule_id: string }[] }) => d.delta.map((x) => x.rule_id).sort();

describe("Mariana baseline (6.4 acceptance)", () => {
  const a = analyze(marianaRows(), marianaStated, TODAY);
  it("has the documented states", () => {
    expect(state(a, "R01").state).toBe("missing");
    expect(state(a, "R05")).toMatchObject({ state: "missing", reason: "evaluation_lists_no_courses" });
    expect(state(a, "R06").state).toBe("from_document");
    expect(state(a, "R04").state).toBe("unknown");
    expect(state(a, "R09").state).toBe("missing");
    expect(state(a, "R11").state).toBe("unknown");
    expect(state(a, "R02").state).toBe("from_document");
  });
  it("lists only Trabajo Docente I and II as the named practicum (D3) and keeps all eight as evidence", () => {
    expect(a.facts.get("transcript.practicum_named")).toEqual(["Trabajo Docente I", "Trabajo Docente II"]);
    expect((a.facts.get("transcript.practicum_courses") as string[]).length).toBe(8);
  });
  it("one headline, the evaluation request, with the school letter as also this week (D11)", () => {
    expect(a.next.headline).toBe("request_evaluation");
    expect(a.next.also).toEqual(["request_school_letter"]);
    expect(a.next.days_left).toBe(38);
  });
  it("has three non-empty buckets plus later, and R04 is the only unknown", () => {
    expect(a.buckets.have.map((r) => r.rule_id)).toEqual(expect.arrayContaining(["R06", "R12", "R02"]));
    expect(a.buckets.unknown.map((r) => r.rule_id)).toEqual(["R04"]);
    expect(a.buckets.later).toHaveLength(5);
  });
});

describe("scenario table", () => {
  const rows = marianaRows();
  const noEval = rows.filter((r) => !r.key.startsWith("evaluation."));

  it("S1 general report from none: R01 unknown to missing and the bridge appears", () => {
    const d = run(noEval, marianaStated, { report_type: "document_by_document" });
    expect(state(d.base, "R01").state).toBe("unknown");
    expect(state(d.hyp, "R01")).toMatchObject({ state: "missing", reason: "report_type_general" });
    expect(d.routeChanges).toContain("bridge_appears");
  });

  it("S2 course-by-course with practicum named: R01 R04 R05 R07 move, next is respond to the letter", () => {
    const d = run(rows, marianaStated, { report_type: "course_by_course" });
    expect(changed(d)).toEqual(["R01", "R04", "R05", "R07"]);
    for (const id of ["R01", "R04", "R05"]) expect(state(d.hyp, id).state).toBe("from_document");
    expect(d.hyp.next.headline).toBe("respond_ctc_letter");
  });

  it("S3 almost nothing this month: no requirement changes, headline flips to the school letter", () => {
    const d = run(rows, marianaStated, { budget: "under_300" });
    expect(d.delta).toEqual([]);
    expect(d.hyp.next).toMatchObject({ headline: "request_school_letter", report_deferred: true, show_cost: false, show_before_paying: false });
  });

  it("S4 school cannot send a letter: action replaced by the CTC question, R05 stays missing", () => {
    const d = run(rows, marianaStated, { school_can_send_letter: "no" });
    expect(d.delta).toEqual([]);
    expect(state(d.hyp, "R05").state).toBe("missing");
    expect(d.hyp.next.also).toEqual(["ask_ctc_question"]);
  });

  it("S5 San Jose to Los Angeles: empty delta except the fingerprint location note", () => {
    const d = run(rows, marianaStated, { city: "Los Angeles" });
    expect(d.delta).toEqual([]);
    expect(d.routeChanges).toEqual(["fingerprint_location"]);
    expect(d.nextChanged).toBe(false);
  });

  it("S6 outside California: R09 moves to FD-258 cards and $49", () => {
    const d = run(rows, marianaStated, { city: "outside" });
    expect(changed(d)).toEqual(["R09"]);
    expect(state(d.hyp, "R09").reason).toBe("fd258_cards");
    expect(d.hyp.route.costs.known.map((c) => c.amount_cents)).toContain(4900);
  });

  it("S7 letter 70 days ago: R21 deadline passed, next is confirm with the CTC", () => {
    const d = run(rows, marianaStated, { letter_date: "2026-08-27" });
    expect(changed(d)).toEqual(["R21"]);
    expect(state(d.hyp, "R21").reason).toBe("deadline_passed");
    expect(d.hyp.next.headline).toBe("confirm_resubmit");
  });

  it("S8 no SSN or ITIN: R11 missing and hard, route keeps showing with the blocker", () => {
    const d = run(rows, marianaStated, { has_ssn_or_itin: "no" });
    expect(changed(d)).toEqual(["R11"]);
    expect(d.hyp.route.blocker).toBe("R11");
    expect(d.hyp.route.steps.length).toBe(5);
  });

  it("S9 and S10 AERC before and after closure", () => {
    const s9 = run(rows, marianaStated, { agency_name: "AERC", report_date: "2025-05-01" });
    expect(state(s9.hyp, "R02").state).toBe("from_document");
    const s10 = run(rows, marianaStated, { agency_name: "AERC", report_date: "2025-10-01" });
    expect(state(s10.hyp, "R02").state).toBe("missing");
  });

  it("S14 transcript with no practicum, alone and with the general report (D5, D6)", () => {
    const alone = analyze(golden("edge/transcript-no-practicum"), {}, TODAY);
    expect(state(alone, "R05")).toMatchObject({ state: "unknown", question: "q.practicum_evidence" });
    expect(alone.next.headline).toBe("ask_ctc_question");
    const withReport = analyze([...golden("edge/transcript-no-practicum"), ...golden("mariana/05-evaluation-report-general")], {}, TODAY);
    expect(state(withReport, "R05")).toMatchObject({ state: "unknown", question: "q.practicum_evidence" });
    expect(withReport.next).toMatchObject({ headline: "ask_ctc_question", also: ["request_evaluation"] });
  });

  it("S15 unknown agency: the post-pass moves R01 R04 R05 R07 (D4)", () => {
    const a = analyze(golden("edge/evaluation-unknown-agency"), {}, TODAY);
    expect(state(a, "R02")).toMatchObject({ state: "missing", reason: "agency_not_on_list" });
    expect(state(a, "R01")).toMatchObject({ state: "missing", reason: "agency_not_approved" });
    expect(state(a, "R04").state).toBe("unknown");
    expect(state(a, "R05")).toMatchObject({ state: "missing", reason: "report_from_unlisted_agency" });
    expect(state(a, "R07")).toMatchObject({ state: "missing", reason: "report_from_unlisted_agency" });
    expect(a.next.headline).toBe("request_evaluation");
  });

  it("S16 the injection transcript produces the same requirement set as Mariana's transcript", () => {
    const strip = (a: ReturnType<typeof analyze>) => a.requirements.map(({ rule_id, state, reason, question }) => ({ rule_id, state, reason, question }));
    const others = rows.filter((r) => r.document_id !== "01-certificado-estudios");
    expect(strip(analyze([...others, ...golden("edge/transcript-injection")], marianaStated, TODAY))).toEqual(strip(analyze(rows, marianaStated, TODAY)));
  });

  it("scenario calls never mutate the real rows", () => {
    const before = JSON.stringify(rows);
    run(rows, marianaStated, { report_type: "course_by_course", city: "outside", letter_date: "2026-01-01" });
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("dry-run regressions", () => {
  it("unlisted agency with a transcript does not tell her to resubmit that report", () => {
    const a = analyze([...golden("mariana/01-certificado-estudios"), ...golden("edge/evaluation-unknown-agency")], {}, TODAY);
    expect(a.next.headline).toBe("request_evaluation");
  });
  it("R21 meta carries the deadline every screen reads", () => {
    const a = analyze(marianaRows(), marianaStated, TODAY);
    expect(state(a, "R21").meta).toMatchObject({ deadline: "2026-12-13", days_left: 38, letter_date: "2026-10-14" });
  });
});
