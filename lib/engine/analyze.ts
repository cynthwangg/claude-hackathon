import { FactIndex, type FactRow } from "../facts";
import { bucket, evaluateAll, type Buckets, type EvalOptions, type Requirement } from "./evaluate";
import { buildRoute, chooseNext, type Next, type RoutePlan } from "./plan";

export type Analysis = { requirements: Requirement[]; buckets: Buckets; next: Next; route: RoutePlan; facts: FactIndex };

export function analyze(rows: FactRow[], stated: Record<string, unknown>, today: Date, opts: EvalOptions = {}): Analysis {
  const facts = new FactIndex(rows, { today, stated, routeKind: opts.routeKind });
  const requirements = evaluateAll(facts, opts);
  return { requirements, buckets: bucket(requirements), next: chooseNext(requirements, facts), route: buildRoute(requirements, facts), facts };
}

export type Patch = Partial<{
  report_type: "as_is" | "none" | "document_by_document" | "course_by_course";
  budget: "as_is" | "under_300" | "can_pay_evaluation" | "whatever";
  school_can_send_letter: "as_is" | "yes" | "no" | "unknown";
  city: "as_is" | "San Jose" | "Los Angeles" | "outside";
  letter_date: string;
  has_ssn_or_itin: "as_is" | "yes" | "no";
  agency_name: string;
  report_date: string;
}>;

export const STATED_KEYS = ["budget", "school_can_send_letter", "city", "lives_in_california", "has_ssn_or_itin"] as const;

const hyp = (key: string, value: unknown): FactRow => ({ id: `hyp:${key}`, key, value, original_text: null, page: null, state: "from_document", source: "hypothetical", document_id: null });

/** Returns new rows and stated facts with the patch applied. Never touches the inputs. */
export function applyPatch(rows: FactRow[], stated: Record<string, unknown>, p: Patch) {
  let out = rows.map((r) => ({ ...r }));
  const st: Record<string, unknown> = { ...stated };
  const replace = (key: string, value: unknown) => {
    out = out.filter((r) => r.key !== key);
    out.push(hyp(key, value));
  };

  if (p.report_type && p.report_type !== "as_is") {
    if (p.report_type === "none") out = out.filter((r) => !r.key.startsWith("evaluation."));
    else {
      const prevReviewed = (out.find((r) => r.key === "evaluation.documents_reviewed")?.value as string[] | undefined) ?? ["Degree", "Transcript"];
      const hadAgency = out.some((r) => r.key === "evaluation.agency_name");
      replace("evaluation.present", true);
      replace("evaluation.report_type", p.report_type);
      if (!out.some((r) => r.key === "evaluation.us_equivalency_statement")) replace("evaluation.us_equivalency_statement", "Bachelor's degree");
      if (p.report_type === "course_by_course") {
        replace("evaluation.lists_courses", true);
        replace("evaluation.mentions_student_teaching", true);
        replace("evaluation.documents_reviewed", [...prevReviewed, "Teaching license"]);
      } else {
        replace("evaluation.lists_courses", false);
        replace("evaluation.mentions_student_teaching", false);
      }
      if (!hadAgency) replace("evaluation.agency_status", "listed");
    }
  }
  if (p.agency_name) replace("evaluation.agency_name", p.agency_name);
  if (p.report_date) replace("evaluation.report_date", p.report_date);
  if (p.letter_date) {
    replace("ctc_letter.present", true);
    replace("ctc_letter.date", p.letter_date);
  }
  if (p.budget && p.budget !== "as_is") st.budget = p.budget;
  if (p.school_can_send_letter && p.school_can_send_letter !== "as_is") st.school_can_send_letter = p.school_can_send_letter;
  if (p.has_ssn_or_itin && p.has_ssn_or_itin !== "as_is") st.has_ssn_or_itin = p.has_ssn_or_itin;
  if (p.city && p.city !== "as_is") {
    st.city = p.city === "outside" ? null : p.city;
    st.lives_in_california = p.city !== "outside";
  }
  return { rows: out, stated: st };
}

export type DeltaItem = { rule_id: string; from: Pick<Requirement, "state" | "reason" | "question">; to: Pick<Requirement, "state" | "reason" | "question"> };
export type RouteChange = "bridge_appears" | "bridge_disappears" | "blocker_appears" | "blocker_clears" | "fingerprint_location" | "fingerprint_method";

export function diff(a: Analysis, b: Analysis, stA: Record<string, unknown>, stB: Record<string, unknown>) {
  const delta: DeltaItem[] = [];
  for (const ra of a.requirements) {
    const rb = b.requirements.find((x) => x.rule_id === ra.rule_id);
    if (!rb) continue;
    if (ra.state !== rb.state || ra.reason !== rb.reason || ra.question !== rb.question)
      delta.push({ rule_id: ra.rule_id, from: { state: ra.state, reason: ra.reason, question: ra.question }, to: { state: rb.state, reason: rb.reason, question: rb.question } });
  }
  const routeChanges: RouteChange[] = [];
  if (!a.route.bridge && b.route.bridge) routeChanges.push("bridge_appears");
  if (a.route.bridge && !b.route.bridge) routeChanges.push("bridge_disappears");
  if (!a.route.blocker && b.route.blocker) routeChanges.push("blocker_appears");
  if (a.route.blocker && !b.route.blocker) routeChanges.push("blocker_clears");
  const ma = a.requirements.find((x) => x.rule_id === "R09")?.meta?.method;
  const mb = b.requirements.find((x) => x.rule_id === "R09")?.meta?.method;
  if (ma !== mb) routeChanges.push("fingerprint_method");
  else if ((stA.city ?? null) !== (stB.city ?? null)) routeChanges.push("fingerprint_location");
  const nextChanged = a.next.headline !== b.next.headline || a.next.also.join() !== b.next.also.join();
  return { delta, routeChanges, nextChanged };
}
