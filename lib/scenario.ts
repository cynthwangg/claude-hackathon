import type { Lang } from "@/rules/types";
import { today } from "./clock";
import { analysisOf, setStated, type LoadedCase } from "./case";
import { db } from "./db";
import { analyze, applyPatch, diff, type Patch } from "./engine/analyze";
import { t } from "./i18n";
import { requirementText, stateWord } from "./present";

type C = NonNullable<LoadedCase>;

const CLEAN: Record<string, string[]> = {
  report_type: ["as_is", "none", "document_by_document", "course_by_course"],
  budget: ["as_is", "under_300", "can_pay_evaluation", "whatever"],
  school_can_send_letter: ["as_is", "yes", "no", "unknown"],
  city: ["as_is", "San Jose", "Los Angeles", "outside"],
  has_ssn_or_itin: ["as_is", "yes", "no"],
};

export function cleanPatch(p: Record<string, unknown>): Patch {
  const out: Record<string, string> = {};
  for (const [k, allowed] of Object.entries(CLEAN)) if (typeof p[k] === "string" && allowed.includes(p[k] as string)) out[k] = p[k] as string;
  if (typeof p.letter_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.letter_date)) out.letter_date = p.letter_date;
  return out as Patch;
}

export async function runScenario(c: C, patch: Patch) {
  const lang: Lang = c.lang;
  const base = analysisOf(c);
  const h = applyPatch(c.rows, c.stated, patch);
  const hyp = analyze(h.rows, h.stated, today(), { routeKind: c.routing.kind });
  const d = diff(base, hyp, c.stated, h.stated);
  const changedIds = new Set(d.delta.map((x) => x.rule_id));
  const visible = (id: string) => [...base.buckets.have, ...base.buckets.needed, ...base.buckets.unknown, ...hyp.buckets.have, ...hyp.buckets.needed, ...hyp.buckets.unknown].some((r) => r.rule_id === id);
  const changes = d.delta.map((x) => {
    const before = base.requirements.find((r) => r.rule_id === x.rule_id)!;
    const after = hyp.requirements.find((r) => r.rule_id === x.rule_id)!;
    return { rule_id: x.rule_id, before: { text: requirementText(lang, before, base.facts), state_word: stateWord(lang, before, base.facts) }, after: { text: requirementText(lang, after, hyp.facts), state_word: stateWord(lang, after, hyp.facts) } };
  });
  const stays = base.requirements
    .filter((r) => !changedIds.has(r.rule_id) && visible(r.rule_id))
    .map((r) => ({ rule_id: r.rule_id, text: requirementText(lang, r, base.facts), state_word: stateWord(lang, r, base.facts) }));
  const notes = d.routeChanges.map((rc) => t(lang, `change.${rc}`));
  let summary: string;
  if (d.delta.length) summary = t(lang, "change.summary.n", { n: d.delta.length });
  else if (d.nextChanged) summary = t(lang, "change.summary.next_only");
  else if (d.routeChanges.includes("fingerprint_location")) summary = t(lang, "change.summary.none");
  else summary = t(lang, "change.summary.nothing");
  const next = d.nextChanged ? { was: t(lang, `action.${base.next.headline}`), now: t(lang, `action.${hyp.next.headline}`) } : null;
  const s = await db.scenario.create({ data: { case_id: c.id, patch: JSON.stringify(patch), delta: JSON.stringify(d) } });
  return { scenario_id: s.id, changes, stays, notes, summary, next, today: today().toISOString().slice(0, 10) };
}

/** D8. Only stated keys become facts. Document keys ask for an upload instead. */
export async function commitScenario(id: string) {
  const s = await db.scenario.findUnique({ where: { id } });
  if (!s) throw new Error("scenario_not_found");
  const p = JSON.parse(s.patch) as Patch;
  const committed: string[] = [];
  const needs_upload: string[] = [];
  if (p.budget && p.budget !== "as_is") { await setStated(s.case_id, "budget", p.budget); committed.push("budget"); }
  if (p.school_can_send_letter && p.school_can_send_letter !== "as_is") { await setStated(s.case_id, "school_can_send_letter", p.school_can_send_letter); committed.push("school_can_send_letter"); }
  if (p.has_ssn_or_itin && p.has_ssn_or_itin !== "as_is") { await setStated(s.case_id, "has_ssn_or_itin", p.has_ssn_or_itin); committed.push("has_ssn_or_itin"); }
  if (p.city && p.city !== "as_is") {
    await setStated(s.case_id, "city", p.city === "outside" ? null : p.city);
    await setStated(s.case_id, "lives_in_california", p.city !== "outside");
    committed.push("city", "lives_in_california");
  }
  if (p.report_type && p.report_type !== "as_is") needs_upload.push(p.report_type === "none" ? "none" : "report");
  if (p.letter_date) needs_upload.push("letter_date");
  await db.scenario.update({ where: { id }, data: { committed: true } });
  return { case_id: s.case_id, committed, needs_upload };
}
