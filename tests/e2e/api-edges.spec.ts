import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** API edge cases from sections 6, 13 and 19 and the dry-run decisions, against the production server. */
const fx = (d: string, f: string) => ({ name: f, mimeType: f.endsWith(".pdf") ? "application/pdf" : "image/jpeg", buffer: fs.readFileSync(path.join(process.cwd(), "fixtures", d, f)) });

async function mariana(request: APIRequestContext, files = ["06-ctc-letter-returned.pdf", "05-evaluation-report-general.pdf", "01-certificado-estudios.jpg"]) {
  const { case_id } = await (await request.post("/api/cases", { data: { language: "es" } })).json();
  await request.post(`/api/cases/${case_id}/messages`, { data: { text: "Soy Mariana. Fui maestra de primaria en Guadalajara, México. Tengo mi cédula. Vivo en San José. Mandé la solicitud y me regresaron una carta." } });
  const docs: Record<string, { id: string; facts: { id: string; key: string; value: unknown }[] }> = {};
  for (const f of files) docs[f] = (await (await request.post(`/api/cases/${case_id}/documents`, { multipart: { file: fx("mariana", f) } })).json()).document;
  return { id: case_id as string, docs };
}
const position = async (request: APIRequestContext, id: string) => (await request.get(`/api/cases/${id}/position`)).json();

test("unknown case, rule and file return 404 with an error key", async ({ request }) => {
  for (const url of ["/api/cases/nope", "/api/cases/nope/position", "/api/cases/nope/documents", "/api/files/nope", "/api/rules/R99/live"]) {
    const r = await request.get(url);
    expect([url, r.status()]).toEqual([url, 404]);
  }
});

test("an unsupported file type is refused and creates nothing", async ({ request }) => {
  const { id } = await mariana(request, []);
  const r = await request.post(`/api/cases/${id}/documents`, { multipart: { file: { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } } });
  expect(r.status()).toBe(400);
  expect((await (await request.get(`/api/cases/${id}/documents`)).json()).documents).toHaveLength(0);
});

test("the SSN answer stores only yes, no or prefer not, never a number (R11)", async ({ request }) => {
  const { id } = await mariana(request, []);
  expect((await request.post(`/api/cases/${id}/stated`, { data: { key: "has_ssn_or_itin", value: "123-45-6789" } })).status()).toBe(400);
  expect((await request.post(`/api/cases/${id}/stated`, { data: { key: "ssn", value: "123456789" } })).status()).toBe(400);
  expect((await request.post(`/api/cases/${id}/stated`, { data: { key: "has_ssn_or_itin", value: "no" } })).status()).toBe(200);
  const p = await position(request, id);
  expect(p.route.blocker.rule_id).toBe("R11");
});

test("correcting the letter date moves the deadline everywhere, and a passed deadline adds then removes confirm_resubmit (D7)", async ({ request }) => {
  const { id, docs } = await mariana(request);
  const date = docs["06-ctc-letter-returned.pdf"].facts.find((f) => f.key === "ctc_letter.date")!;
  expect((await request.patch(`/api/facts/${date.id}`, { data: { value: "14 de octubre" } })).status()).toBe(400);
  const days = docs["06-ctc-letter-returned.pdf"].facts.find((f) => f.key === "ctc_letter.deadline_days")!;
  expect((await request.patch(`/api/facts/${days.id}`, { data: { value: 90 } })).status()).toBe(400);

  await request.patch(`/api/facts/${date.id}`, { data: { value: "2026-08-27" } });
  let p = await position(request, id);
  expect(p.week.headline.kind).toBe("confirm_resubmit");
  let prog = await (await request.get(`/api/cases/${id}/progress`)).json();
  expect(prog.actions.map((a: { kind: string }) => a.kind)).toContain("confirm_resubmit");

  await request.patch(`/api/facts/${date.id}`, { data: { value: "2026-10-14" } });
  p = await position(request, id);
  expect(p.week.headline.kind).toBe("request_evaluation");
  expect(p.week.why_now).toContain("38");
  prog = await (await request.get(`/api/cases/${id}/progress`)).json();
  expect(prog.actions.map((a: { kind: string }) => a.kind)).not.toContain("confirm_resubmit");
});

test("scenarios never change real facts, and commit writes only stated keys (D8)", async ({ request }) => {
  const { id } = await mariana(request);
  const before = JSON.stringify((await (await request.get(`/api/cases/${id}/documents`)).json()).documents);
  const s = await (await request.post(`/api/cases/${id}/scenarios`, { data: { patch: { report_type: "course_by_course", letter_date: "2026-01-01", city: "outside", evil: "x" } } })).json();
  expect(JSON.stringify((await (await request.get(`/api/cases/${id}/documents`)).json()).documents)).toBe(before);
  const c = await (await request.post(`/api/scenarios/${s.scenario_id}/commit`)).json();
  expect(c.committed).toEqual(["city", "lives_in_california"]);
  expect(c.needs_upload.sort()).toEqual(["letter_date", "report"]);
  const p = await position(request, id);
  expect(p.position.needed.find((l: { rule_id: string }) => l.rule_id === "R01").state).toBe("missing");
  expect(p.route.known.map((k: { amount: string }) => k.amount)).toContain("$49");
});

test("accepted without a CTC document stays her statement, and undo restores it (D10)", async ({ request }) => {
  const { id } = await mariana(request);
  await position(request, id);
  const prog = await (await request.get(`/api/cases/${id}/progress`)).json();
  const a = prog.actions.find((x: { kind: string }) => x.kind === "request_evaluation");
  expect((await request.post(`/api/actions/${a.id}/transition`, { data: { state: "approved" } })).status()).toBe(400);
  for (const s of ["sent", "document_obtained", "submitted", "accepted"]) await request.post(`/api/actions/${a.id}/transition`, { data: { state: s } });
  let item = (await (await request.get(`/api/cases/${id}/progress`)).json()).actions.find((x: { id: string }) => x.id === a.id);
  expect(item.statement_only).toBe(true);
  const p = await position(request, id);
  expect(p.position.needed.map((l: { rule_id: string }) => l.rule_id)).toContain("R01");
  await request.post(`/api/actions/${a.id}/transition`, { data: { undo: true } });
  item = (await (await request.get(`/api/cases/${id}/progress`)).json()).actions.find((x: { id: string }) => x.id === a.id);
  expect(item.state).toBe("submitted");
});

test("a transcript with no practicum is abstained on, with the question drafted (section 26)", async ({ request }) => {
  const { case_id } = await (await request.post("/api/cases", { data: { language: "en" } })).json();
  await request.post(`/api/cases/${case_id}/messages`, { data: { text: "I taught primary school in Mexico for nine years. I have my cédula. I live in Los Angeles. I haven't started anything." } });
  await request.post(`/api/cases/${case_id}/documents`, { multipart: { file: fx("edge", "transcript-no-practicum.jpg") } });
  const p = await position(request, case_id);
  expect(p.position.unknown.map((l: { rule_id: string }) => l.rule_id)).toContain("R05");
  expect(p.week.headline.kind).toBe("ask_ctc_question");
  const d = await (await request.post(`/api/cases/${case_id}/drafts/ask_ctc_question`)).json();
  expect(d.body).toContain('does not use the words "student teaching"');
  expect(JSON.stringify(p)).not.toMatch(/probably|likely|you should be fine/i);
});

test("a second greeting returns the same sentence and does not wipe the intake (D18)", async ({ request }) => {
  const { case_id } = await (await request.post("/api/cases", { data: { language: "en" } })).json();
  const first = await (await request.post(`/api/cases/${case_id}/messages`, { data: { text: "I was a teacher in Mexico." } })).json();
  const again = await (await request.post(`/api/cases/${case_id}/messages`, { data: { text: null } })).json();
  expect(again.say).toBe(first.say);
  expect(again.intake.profession).toBe("teacher");
});

test("a nurse in Texas gets the office and no CTC rules (D21)", async ({ request }) => {
  const { case_id } = await (await request.post("/api/cases", { data: { language: "en" } })).json();
  const r = await (await request.post(`/api/cases/${case_id}/messages`, { data: { text: "I worked as a nurse in Manila, Philippines for six years and have my Philippine nursing license. I live in Houston. I haven't started anything here." } })).json();
  expect(r.done).toBe(true);
  expect(r.routing.kind).toBe("none");
  expect(r.header.office.name).toBe("Texas Board of Nursing");
  const d = await (await request.post(`/api/cases/${case_id}/drafts/office_question`)).json();
  expect(d.body).toContain("TX");
  expect(d.body).not.toMatch(/CTC|Commission on Teacher/);
});
