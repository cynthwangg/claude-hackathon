import { KNOWN_FEES_CENTS, ruleById } from "@/rules/ctc-ms-foreign";
import type { ReqState } from "@/rules/types";
import type { FactIndex } from "../facts";
import type { Requirement } from "./evaluate";

export type ActionKind =
  | "request_evaluation"
  | "request_school_letter"
  | "respond_ctc_letter"
  | "live_scan"
  | "ask_ctc_question"
  | "confirm_resubmit"
  | "apply_ctc"
  | "upload_evaluation"
  | "wait";

export const ACTION_RULES: Record<ActionKind, string[]> = {
  request_evaluation: ["R01", "R02", "R04", "R05", "R07"],
  request_school_letter: ["R05"],
  respond_ctc_letter: ["R21"],
  live_scan: ["R09"],
  ask_ctc_question: ["R05"],
  confirm_resubmit: ["R21"],
  apply_ctc: ["R10"],
  upload_evaluation: ["R01"],
  wait: [],
};

export type Next = {
  headline: ActionKind;
  also: ActionKind[];
  report_deferred: boolean;
  show_cost: boolean;
  show_before_paying: boolean;
  days_left?: number;
  deadline?: string;
};

const SAT: ReqState[] = ["official", "checked", "from_document"];

export function chooseNext(reqs: Requirement[], f: FactIndex): Next {
  const r = (id: string) => reqs.find((x) => x.rule_id === id);
  const sat = (id: string) => SAT.includes(r(id)?.state ?? "unknown");
  const missing = (id: string) => r(id)?.state === "missing";
  const budget = f.get<string>("stated.budget");
  const school = f.get<string>("stated.school_can_send_letter");
  const stage = f.get<string>("stated.stage");
  const hasPracticum = f.has("transcript.practicum_courses");
  const cbc = f.get("evaluation.report_type") === "course_by_course";
  const r21 = r("R21");
  const base = { report_deferred: false, show_cost: true, show_before_paying: true, days_left: r21?.meta?.days_left as number | undefined, deadline: r21?.meta?.deadline as string | undefined };
  const done = (headline: ActionKind, also: (ActionKind | null)[] = [], extra: Partial<Next> = {}): Next => ({ ...base, headline, also: also.filter((x): x is ActionKind => !!x && x !== headline), ...extra });

  if (r21?.reason === "deadline_passed") return done("confirm_resubmit");

  if (r("R05")?.question === "q.practicum_evidence" && f.has("transcript.present") && !cbc) return done("ask_ctc_question", ["request_evaluation"]);

  if (r("R01")?.state === "unknown") {
    if (stage === "evaluation_in_hand" || stage === "applied_letter_received") return done("upload_evaluation");
    return done("request_evaluation");
  }

  const evalWork = missing("R01") || missing("R02") || missing("R07") || (missing("R05") && !cbc) || (cbc && missing("R05"));
  if (evalWork) {
    const r05Open = !sat("R05");
    const schoolAction: ActionKind | null = hasPracticum && r05Open ? (school === "no" ? "ask_ctc_question" : "request_school_letter") : null;
    if (budget === "under_300" && schoolAction) return done(schoolAction, [], { report_deferred: true, show_cost: false, show_before_paying: false });
    if (cbc && sat("R01") && sat("R02") && schoolAction) return done(schoolAction, []);
    return done("request_evaluation", [schoolAction]);
  }

  const liveScan = missing("R09") ? "live_scan" : null;
  if (r21 && r21.reason === "respond_by") return done("respond_ctc_letter", [liveScan]);
  if (missing("R10")) return done("apply_ctc", [liveScan]);
  if (liveScan) return done("live_scan");
  return done("wait");
}

export type RouteStep = { key: string; rule_ids: string[]; state: ReqState | "waiting"; meta?: Record<string, unknown> };
export type Cost = { label_key: string; amount_cents?: number; rule_id: string; paid?: boolean };
export type RoutePlan = {
  steps: RouteStep[];
  costs: { known: Cost[]; external: Cost[] };
  bridge: boolean;
  blocker: string | null;
};

function worst(states: ReqState[]): ReqState {
  if (states.includes("missing")) return "missing";
  if (states.includes("unknown")) return "unknown";
  if (states.includes("from_document")) return "from_document";
  if (states.includes("checked")) return "checked";
  return "official";
}

export function buildRoute(reqs: Requirement[], f: FactIndex): RoutePlan {
  const st = (ids: string[]) => worst(ids.map((id) => reqs.find((x) => x.rule_id === id)?.state ?? "unknown"));
  const r21 = reqs.find((x) => x.rule_id === "R21");
  const hasLetter = f.has("ctc_letter.date");
  const outside = f.get("stated.lives_in_california") === false;
  const steps: RouteStep[] = [
    { key: "route.step.evaluation", rule_ids: ["R01", "R02", "R07"], state: st(["R01", "R02", "R07"]) },
    { key: "route.step.practicum", rule_ids: ["R05"], state: st(["R05"]) },
    hasLetter
      ? { key: "route.step.respond_letter", rule_ids: ["R21"], state: st(["R21"]), meta: r21?.meta }
      : { key: "route.step.apply", rule_ids: ["R10"], state: st(["R10"]) },
    { key: outside ? "route.step.fd258" : "route.step.live_scan", rule_ids: ["R09"], state: st(["R09"]) },
    { key: "route.step.ctc_reviews", rule_ids: ["P01"], state: "waiting" },
  ];
  const applied = SAT.includes(reqs.find((x) => x.rule_id === "R10")?.state ?? "unknown");
  const known: Cost[] = [
    { label_key: "cost.application", amount_cents: KNOWN_FEES_CENTS.application, rule_id: "R10", paid: applied },
    { label_key: "cost.online_service", amount_cents: KNOWN_FEES_CENTS.online_service, rule_id: "R10", paid: applied },
  ];
  if (outside) known.push({ label_key: "cost.fd258", amount_cents: KNOWN_FEES_CENTS.fd258, rule_id: "R09" });
  const external: Cost[] = [{ label_key: "cost.evaluation", rule_id: "R01" }];
  if (!outside) external.push({ label_key: "cost.live_scan", rule_id: "R09" });
  const blocker = reqs.find((x) => x.state === "missing" && ruleById(x.rule_id).hard)?.rule_id ?? null;
  return { steps, costs: { known, external }, bridge: f.get("evaluation.report_type") === "document_by_document", blocker };
}
