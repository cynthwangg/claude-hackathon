import { rules as allRules } from "@/rules/ctc-ms-foreign";
import type { Cond, Outcome, ReqState, Rule } from "@/rules/types";
import type { FactIndex } from "../facts";
import { containsAny } from "../norm";

export type Requirement = {
  rule_id: string;
  state: ReqState;
  reason?: string;
  question?: string;
  evidence: string[];
  meta?: Record<string, unknown>;
};

export function test(c: Cond, f: FactIndex): boolean {
  if ("all" in c) return c.all.every((x) => test(x, f));
  if ("any" in c) return c.any.some((x) => test(x, f));
  if ("not" in c) return !test(c.not, f);
  const v = f.get(c.fact);
  if ("exists" in c) return f.has(c.fact) === c.exists;
  if (v === undefined) return false;
  if ("eq" in c) return v === c.eq;
  if ("in" in c) return c.in.includes(v);
  if ("contains_any" in c) return (Array.isArray(v) ? v : [v]).some((x) => typeof x === "string" && containsAny(x, c.contains_any));
  if ("before" in c) return typeof v === "string" && v < c.before;
  if ("gte" in c) return typeof v === "number" && v >= c.gte;
  return false;
}

export function evaluateRule(rule: Rule, f: FactIndex): Requirement {
  if (f.officialDecisionFor(rule.id)) return { rule_id: rule.id, state: "official", evidence: f.idsFor(["ctc_decision.satisfied"]) };
  const logic = rule.logic;
  if (!logic) return { rule_id: rule.id, state: "unknown", question: "q.none", evidence: [] };
  const hit = logic.cases.find((c) => test(c.when, f));
  const o: Outcome = hit ?? logic.otherwise;
  const keys = (o.evidence ?? []).filter((k) => f.has(k));
  const evidence = f.idsFor(keys);
  if (o.state === "satisfied") {
    const best = f.bestStateFor(keys);
    const state = rule.discretion && best !== "official" ? "from_document" : best;
    return { rule_id: rule.id, state, evidence };
  }
  if (o.state === "missing") return { rule_id: rule.id, state: "missing", reason: o.reason, evidence };
  return { rule_id: rule.id, state: "unknown", question: o.question, evidence };
}

export type EvalOptions = { routeKind?: "match" | "near" | "none" };

/** Evaluates every requirement rule, then applies the cross-rule post-pass (D4). Pure. */
export function evaluateAll(f: FactIndex, opts: EvalOptions = {}): Requirement[] {
  const out = allRules
    .filter((r) => r.kind === "requirement")
    .filter((r) => !(opts.routeKind === "near" && r.id === "R12"))
    .map((r) => evaluateRule(r, f));
  const by = (id: string) => out.find((r) => r.rule_id === id);

  const r02 = by("R02");
  if (r02?.state === "missing") {
    const set = (id: string, patch: Partial<Requirement>) => {
      const r = by(id);
      if (r) Object.assign(r, { reason: undefined, question: undefined }, patch);
    };
    set("R01", { state: "missing", reason: "agency_not_approved" });
    set("R04", { state: "unknown", question: "q.equivalence_decided_by_agency" });
    set("R05", { state: "missing", reason: "report_from_unlisted_agency" });
    set("R07", { state: "missing", reason: "report_from_unlisted_agency" });
  }

  const r21 = by("R21");
  if (r21 && f.has("ctc_letter.deadline")) {
    r21.meta = { deadline: f.get("ctc_letter.deadline"), days_left: f.get("ctc_letter.days_left"), letter_date: f.get("ctc_letter.date") };
  }
  const r09 = by("R09");
  if (r09) r09.meta = { method: f.get("stated.lives_in_california") === false ? "fd258" : "live_scan" };
  return out;
}

export type Buckets = { have: Requirement[]; needed: Requirement[]; unknown: Requirement[]; later: Requirement[] };

export function bucket(reqs: Requirement[]): Buckets {
  const rule = (id: string) => allRules.find((r) => r.id === id)!;
  const b: Buckets = { have: [], needed: [], unknown: [], later: [] };
  for (const r of reqs) {
    const ru = rule(r.rule_id);
    if (ru.route_only) continue;
    if (ru.phase === "B") { b.later.push(r); continue; }
    if (r.state === "missing") b.needed.push(r);
    else if (r.state === "unknown") { if (r.question !== "q.none" && !ru.quiet) b.unknown.push(r); }
    else b.have.push(r);
  }
  return b;
}
