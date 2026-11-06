import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import type { FactRow } from "@/lib/facts";
import { TODAY, marianaRows, marianaStated } from "../helpers";

/** Real Claude reading of the phone-photo fixtures. Run with `pnpm test:live`; costs a few API calls. */
for (const line of fs.existsSync(".env") ? fs.readFileSync(".env", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.MODEL_PROVIDER = "anthropic";

const live = process.env.LIVE === "1" ? describe : describe.skip;
const read = async (dir: string, file: string, hint: string | null) => {
  const { anthropicProvider } = await import("@/lib/model/anthropic");
  const bytes = fs.readFileSync(path.join("fixtures", dir, file));
  return anthropicProvider.readDocument({ bytes, mime: file.endsWith(".pdf") ? "application/pdf" : "image/jpeg", name: `upload-${Date.now()}${path.extname(file)}` }, hint);
};
const toRows = (facts: { key: string; value: unknown; original_text: string | null; page: number | null }[], doc: string): FactRow[] =>
  facts.map((f, i) => ({ id: `${doc}:${i}`, key: f.key, value: f.value, original_text: f.original_text, page: f.page, state: "from_document", source: "document", document_id: doc }));
const get = (facts: { key: string; value: unknown }[], k: string) => facts.find((f) => f.key === k)?.value;

live("live reading with Claude", () => {
  const rows: FactRow[] = [];

  it("a page-one photo of the evaluation does not invent a report type", async () => {
    const r = await read("mariana", "05-evaluation-report-general.jpg", "evaluation_report");
    expect(r.kind).toBe("evaluation_report");
    expect(get(r.facts, "evaluation.report_type")).toBeUndefined();
  });

  it("reads the CTC letter photo: date, two items, 60 days", async () => {
    const r = await read("mariana", "06-ctc-letter-returned.jpg", "ctc_letter");
    expect(r.kind).toBe("ctc_letter");
    expect(get(r.facts, "ctc_letter.date")).toBe("2026-10-14");
    expect((get(r.facts, "ctc_letter.items") as unknown[]).length).toBe(2);
    expect(get(r.facts, "ctc_letter.deadline_days")).toBe(60);
    rows.push(...toRows(r.facts, "letter"));
  });

  it("reads the evaluation photo as a general report from ECE", async () => {
    const r = await read("mariana", "05-evaluation-report-general.pdf", "evaluation_report");
    expect(r.kind).toBe("evaluation_report");
    expect(get(r.facts, "evaluation.report_type")).toBe("document_by_document");
    expect(String(get(r.facts, "evaluation.agency_name"))).toMatch(/Educational Credential Evaluators/);
    expect(get(r.facts, "evaluation.lists_courses")).toBe(false);
    rows.push(...toRows(r.facts, "eval"));
  });

  it("reads the transcript photo with Trabajo Docente I and II, under a wrong hint", async () => {
    const r = await read("mariana", "01-certificado-estudios.pdf", "degree");
    expect(r.kind).toBe("transcript");
    const courses = get(r.facts, "transcript.course_names") as string[];
    expect(courses.some((c) => /^trabajo docente i$/i.test(c.trim()))).toBe(true);
    expect(courses.some((c) => /^trabajo docente ii$/i.test(c.trim()))).toBe(true);
    rows.push(...toRows(r.facts, "transcript"));
  });

  it("reads the cédula photo as a license", async () => {
    const r = await read("mariana", "03-cedula-profesional.jpg", "license");
    expect(r.kind).toBe("license");
    rows.push(...toRows(r.facts, "license"));
  });

  it("code reaches the same requirement states from Claude's reading as from the golden facts", () => {
    const pick = (a: ReturnType<typeof analyze>) => Object.fromEntries(a.requirements.filter((r) => ["R01", "R02", "R04", "R05", "R06", "R07", "R21"].includes(r.rule_id)).map((r) => [r.rule_id, `${r.state}:${r.reason ?? r.question ?? ""}`]));
    const golden = marianaRows().filter((r) => ["06-ctc-letter-returned", "05-evaluation-report-general", "01-certificado-estudios", "03-cedula-profesional"].includes(r.document_id!));
    expect(pick(analyze(rows, marianaStated, TODAY))).toEqual(pick(analyze(golden, marianaStated, TODAY)));
  });

  it("the injection transcript changes nothing and the instruction is only recorded", async () => {
    const r = await read("edge", "transcript-injection.pdf", "transcript");
    expect(r.kind).toBe("transcript");
    expect(r.raw_text ?? "").toMatch(/ignore previous instructions/i);
    expect(r.facts.some((f) => /^ctc_decision|stated\./.test(f.key))).toBe(false);
  });
});
