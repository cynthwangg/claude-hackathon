import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import type { FactState, Lang } from "@/rules/types";
import { today } from "./clock";
import { db } from "./db";
import { analyze, type Analysis } from "./engine/analyze";
import type { ActionKind } from "./engine/plan";
import type { FactRow } from "./facts";
import { guardModelText } from "./guard";
import { asLang } from "./i18n";
import { routeIntake, type Routing } from "./intake/router";
import { emptyIntake, mergeIntake, missingRequired, type Intake, type Turn } from "./intake/types";
import { provider } from "./model";
import type { FileInput } from "./model/types";

const run = promisify(execFile);
export const UPLOADS = path.join(process.cwd(), "uploads");

export type LoadedCase = Awaited<ReturnType<typeof loadCase>>;

const parse = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export function toRow(f: { id: string; key: string; value: string; original_text: string | null; page: number | null; state: string; source: string; document_id: string | null }): FactRow {
  return { id: f.id, key: f.key, value: parse(f.value, f.value), original_text: f.original_text, page: f.page, state: f.state as FactState, source: f.source, document_id: f.document_id };
}

export function statedFrom(i: Intake): Record<string, unknown> {
  return {
    first_name: i.first_name,
    has_foreign_license: i.has_foreign_license,
    stage: i.stage,
    lives_in_california: i.us_state ? i.us_state === "CA" : undefined,
    city: i.city,
  };
}

export async function createCase(language: string) {
  return db.case.create({ data: { language: asLang(language), intake: JSON.stringify(emptyIntake()) } });
}

export async function loadCase(id: string) {
  const c = await db.case.findUnique({
    where: { id },
    include: { facts: { where: { hypothetical: false }, orderBy: { created_at: "asc" } }, documents: { orderBy: { created_at: "asc" } }, actions: { orderBy: { created_at: "asc" } } },
  });
  if (!c) return null;
  const intake = { ...emptyIntake(), ...parse<Partial<Intake>>(c.intake, {}) };
  const routing = routeIntake(intake);
  return { ...c, lang: asLang(c.language), intakeObj: intake, routing, rows: c.facts.map(toRow), stated: statedFrom(intake), history: parse<Turn[]>(c.history, []) };
}

export function analysisOf(c: NonNullable<LoadedCase>): Analysis {
  return analyze(c.rows, c.stated, today(), { routeKind: c.routing.kind });
}

/* ---------- intake ---------- */

export type IntakeResult = { say: string | null; intake: Intake; done: boolean; missing: string[]; routing: Routing; language: Lang };

export async function intakeMessage(caseId: string, text: string | null): Promise<IntakeResult> {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const history = c.history;
  // D18: a second greeting request returns the same sentence.
  if (text === null && history.length) {
    const last = [...history].reverse().find((h) => h.role === "assistant");
    const missing = missingRequired(c.intakeObj);
    return { say: last?.text ?? null, intake: c.intakeObj, done: missing.length === 0, missing, routing: c.routing, language: c.lang };
  }
  const turns: Turn[] = text ? [...history, { role: "user", text }] : history;
  const reply = await provider().intakeTurn(c.lang, turns, c.intakeObj, missingRequired(c.intakeObj));
  const intake = mergeIntake(c.intakeObj, reply.intake);
  const missing = missingRequired(intake);
  const done = missing.length === 0;
  let language = c.lang;
  if (text && history.filter((h) => h.role === "user").length === 0 && intake.language && intake.language !== c.lang) language = intake.language;
  const say = done ? null : guardModelText(reply.say) ?? null;
  const nextHistory: Turn[] = say ? [...turns, { role: "assistant", text: say }] : turns;
  await db.case.update({ where: { id: caseId }, data: { intake: JSON.stringify(intake), history: JSON.stringify(nextHistory), first_name: intake.first_name ?? c.first_name, language, pathway_id: routeIntake(intake).pathway?.id ?? null } });
  return { say, intake, done, missing, routing: routeIntake(intake), language };
}

export async function updateIntake(caseId: string, patch: Partial<Intake>) {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const intake = { ...c.intakeObj, ...patch };
  if (intake.us_state) intake.us_state = intake.us_state.toUpperCase().slice(0, 2);
  await db.case.update({ where: { id: caseId }, data: { intake: JSON.stringify(intake), first_name: intake.first_name ?? c.first_name, pathway_id: routeIntake(intake).pathway?.id ?? null } });
  return intake;
}

/* ---------- documents ---------- */

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heic" };
export const ACCEPTED_MIME = Object.keys(EXT);

async function makePreview(file: string, mime: string, out: string) {
  if (mime === "application/pdf") {
    try {
      await run("pdftoppm", ["-jpeg", "-r", "110", "-f", "1", "-l", "1", "-singlefile", file, out.replace(/\.jpg$/, "")]);
      return out;
    } catch {
      return null;
    }
  }
  try {
    await sharp(file).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(out);
    return out;
  } catch {
    return null;
  }
}

export async function ingestDocument(caseId: string, file: FileInput, kindHint: string | null) {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const ext = EXT[file.mime];
  if (!ext) throw new Error("unsupported_type");
  const doc = await db.document.create({ data: { case_id: caseId, kind: kindHint ?? "other", status: "reading", mime: file.mime, file_name: file.name.slice(0, 200) } });
  const dir = path.join(UPLOADS, caseId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${doc.id}.${ext}`);
  await fs.writeFile(filePath, file.bytes);
  await makePreview(filePath, file.mime, path.join(dir, `${doc.id}-preview.jpg`));

  let result;
  try {
    result = await provider().readDocument(file, kindHint);
  } catch (e) {
    await db.document.update({ where: { id: doc.id }, data: { status: "unreadable", file_path: filePath } });
    throw e;
  }
  if (!result.facts.length) {
    await db.document.update({ where: { id: doc.id }, data: { status: "unreadable", file_path: filePath } });
    return documentView(doc.id);
  }
  await db.fact.createMany({
    data: result.facts.map((f) => ({ case_id: caseId, document_id: doc.id, key: f.key, value: JSON.stringify(f.value), original_text: f.original_text, page: f.page, state: "from_document", source: "document" })),
  });
  await db.document.update({
    where: { id: doc.id },
    data: { kind: result.kind, language: result.language, status: "read", file_path: filePath, raw_text: result.raw_text, page_count: result.page_count, model: provider().name },
  });
  if (result.kind === "ctc_letter") await refreshReadingAid(doc.id);
  return documentView(doc.id);
}

/** D14. The reading aid is generated from the extracted letter facts, in her language. */
export async function refreshReadingAid(documentId: string) {
  const d = await db.document.findUnique({ where: { id: documentId }, include: { facts: true, case: true } });
  if (!d || d.kind !== "ctc_letter") return;
  const lang = asLang(d.case.language);
  const get = (k: string) => parse<unknown>(d.facts.find((f) => f.key === k)?.value, undefined);
  const items = (get("ctc_letter.items") as { number: number; text: string }[] | undefined) ?? [];
  const text = [
    `Date ${get("ctc_letter.date") ?? ""}`,
    `Subject ${get("ctc_letter.subject") ?? ""}`,
    `Application ${get("ctc_letter.application_title") ?? ""}`,
    ...items.map((i) => `${i.number}. ${i.text}`),
    "The applicant has 60 days from the date of the letter to submit the requested materials, and the materials must be accompanied by a copy of the letter.",
  ].join("\n");
  let aid: string | null = null;
  try {
    aid = guardModelText(await provider().readingAid(lang, text));
  } catch {
    aid = null;
  }
  await db.document.update({ where: { id: documentId }, data: { reading_aid: aid } });
}

export async function documentView(id: string) {
  const d = await db.document.findUnique({ where: { id }, include: { facts: { where: { hypothetical: false }, orderBy: { created_at: "asc" } } } });
  if (!d) return null;
  return {
    id: d.id,
    kind: d.kind,
    status: d.status,
    language: d.language,
    file_name: d.file_name,
    reading_aid: d.reading_aid,
    injection: !!d.raw_text && d.raw_text.includes("embedded_instructions"),
    confirmed: d.facts.length > 0 && d.facts.every((f) => f.confirmed_by_user),
    preview: `/api/files/${d.id}?preview=1`,
    original: `/api/files/${d.id}`,
    facts: d.facts.map((f) => ({ id: f.id, key: f.key, value: parse(f.value, f.value), original_text: f.original_text, page: f.page, corrected: f.corrected })),
  };
}

export async function correctFact(factId: string, value: unknown) {
  const f = await db.fact.findUnique({ where: { id: factId } });
  if (!f || f.hypothetical) throw new Error("fact_not_found");
  if (f.key === "ctc_letter.deadline_days" || f.key === "ctc_letter.items") throw new Error("read_only");
  if (/(^|\.)(date|start_date|end_date|issue_date|report_date|start|end)$/.test(f.key) && !(typeof value === "string" && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value.trim()))) throw new Error("bad_value");
  const updated = await db.fact.update({ where: { id: factId }, data: { value: JSON.stringify(value), corrected: true, confirmed_by_user: true } });
  if (f.key.startsWith("ctc_letter.") && f.document_id) await refreshReadingAid(f.document_id);
  return updated;
}

export async function confirmDocument(documentId: string) {
  await db.fact.updateMany({ where: { document_id: documentId }, data: { confirmed_by_user: true } });
}

/** Stated facts she gives after intake (budget, SSN yes/no, school letter). Never the SSN itself. */
export async function setStated(caseId: string, key: string, value: unknown) {
  const allowed = ["budget", "school_can_send_letter", "city", "lives_in_california", "has_ssn_or_itin", "originals_available"];
  if (!allowed.includes(key)) throw new Error("not_a_stated_key");
  // R11 stores only the answer, never a number.
  if (key === "has_ssn_or_itin" && value !== null && !["yes", "no", "prefer_not"].includes(value as string)) throw new Error("not_a_stated_key");
  await db.fact.deleteMany({ where: { case_id: caseId, key: `stated.${key}`, hypothetical: false } });
  if (value === null || value === undefined) return;
  await db.fact.create({ data: { case_id: caseId, key: `stated.${key}`, value: JSON.stringify(value), state: "from_document", source: "statement" } });
}

/* ---------- evaluation and actions ---------- */

const TRACKED: ActionKind[] = ["request_evaluation", "request_school_letter", "ask_ctc_question", "respond_ctc_letter", "live_scan", "confirm_resubmit", "apply_ctc"];

export async function evaluateAndSync(caseId: string) {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const a = analysisOf(c);
  const runId = `run_${Date.now().toString(36)}`;
  await db.requirement.createMany({ data: a.requirements.map((r) => ({ case_id: caseId, rule_id: r.rule_id, state: r.state, reason: r.reason ?? null, question: r.question ?? null, evidence: JSON.stringify(r.evidence), run_id: runId })) });

  if (c.routing.kind !== "none") {
    const want = new Set<ActionKind>([a.next.headline, ...a.next.also].filter((k) => TRACKED.includes(k)));
    if (a.facts.has("ctc_letter.date") && a.next.headline !== "confirm_resubmit") want.add("respond_ctc_letter");
    if (a.requirements.find((r) => r.rule_id === "R09")?.state === "missing" && a.facts.has("ctc_letter.date")) want.add("live_scan");
    const existing = new Map(c.actions.map((x) => [x.kind, x]));
    const deadline = a.facts.get<string>("ctc_letter.deadline");
    for (const kind of want) {
      if (!existing.has(kind)) {
        await db.action.create({ data: { case_id: caseId, kind, rule_ids: JSON.stringify(ruleIdsFor(kind)), state: "not_started", deadline: deadline && (kind === "respond_ctc_letter") ? new Date(`${deadline}T12:00:00Z`) : null, history: JSON.stringify([{ state: "not_started", at: today().toISOString() }]) } });
      }
    }
    for (const x of c.actions) {
      if (x.kind === "respond_ctc_letter") await db.action.update({ where: { id: x.id }, data: { deadline: deadline ? new Date(`${deadline}T12:00:00Z`) : null } });
      if (x.kind === "confirm_resubmit" && !want.has("confirm_resubmit")) await db.action.delete({ where: { id: x.id } });
    }
  }
  return a;
}

function ruleIdsFor(kind: ActionKind) {
  return { request_evaluation: ["R01", "R02", "R05", "R07"], request_school_letter: ["R05"], ask_ctc_question: ["R05"], respond_ctc_letter: ["R21"], live_scan: ["R09"], confirm_resubmit: ["R21"], apply_ctc: ["R10"], upload_evaluation: ["R01"], wait: [] }[kind];
}

export const PROGRESS_STATES = ["not_started", "sent", "document_obtained", "submitted", "accepted"] as const;

type HistoryEntry = { state: string; at: string; source?: string };

/** Facts her statements set, so the rules see a step she says is done. Never official. */
async function syncStatementFacts(caseId: string, kind: string, state: string) {
  const key = ({ respond_ctc_letter: "ctc_letter.responded", live_scan: "fingerprints.done" } as Record<string, string>)[kind];
  if (!key) return;
  await db.fact.deleteMany({ where: { case_id: caseId, key, source: "statement" } });
  const done = kind === "live_scan" ? state !== "not_started" && state !== "sent" : state === "submitted" || state === "accepted";
  if (done) await db.fact.create({ data: { case_id: caseId, key, value: "true", state: "from_document", source: "statement" } });
}

/** D10. Her statements move tracked items. Only a CTC document makes anything official. */
export async function transition(actionId: string, state: string, evidenceDocumentId: string | null) {
  const x = await db.action.findUnique({ where: { id: actionId } });
  if (!x) throw new Error("action_not_found");
  if (!(PROGRESS_STATES as readonly string[]).includes(state)) throw new Error("bad_state");
  const history = parse<HistoryEntry[]>(x.history, []);
  let source = "statement";
  if (state === "accepted" && evidenceDocumentId) {
    const d = await db.document.findUnique({ where: { id: evidenceDocumentId } });
    if (d && d.case_id === x.case_id && d.kind === "ctc_letter") {
      source = "document";
      await db.fact.create({ data: { case_id: x.case_id, document_id: d.id, key: "ctc_decision.satisfied", value: x.rule_ids, state: "official", source: "document" } });
    }
  }
  history.push({ state, at: today().toISOString(), source });
  const updated = await db.action.update({ where: { id: actionId }, data: { state, history: JSON.stringify(history) } });
  await syncStatementFacts(x.case_id, x.kind, state);
  return updated;
}

export async function undoTransition(actionId: string) {
  const x = await db.action.findUnique({ where: { id: actionId } });
  if (!x) throw new Error("action_not_found");
  const history = parse<HistoryEntry[]>(x.history, []);
  if (history.length > 1) history.pop();
  const prev = history[history.length - 1]?.state ?? "not_started";
  const updated = await db.action.update({ where: { id: actionId }, data: { state: prev, history: JSON.stringify(history) } });
  await syncStatementFacts(x.case_id, x.kind, prev);
  return updated;
}

