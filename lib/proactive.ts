import type { Program } from "@/data/programs";
import type { Lang, ReqState } from "@/rules/types";
import { introCandidate, introOffer, peerTiming, type Member, type Step } from "./circle";
import { say, type CopyKey } from "./copy";
import type { Analysis } from "./engine/analyze";
import type { ActionKind } from "./engine/plan";
import { fmtDate, t } from "./i18n";
import { ruleTitle } from "./present";

/**
 * Section 34, the Inform and Prepare classes. Pure. Given her case now and what she was last told, it says what changed,
 * what is ready for her, and what others from her program went through at this step.
 *
 * The sandbox cannot start a conversation, so these lead the reply whenever she writes (34.3), on WhatsApp and on the web.
 * In a pilot the same list feeds approved templates.
 */
export type Snapshot = Record<string, ReqState>;
export type Memory = { snapshot: Snapshot | null; deadline_sent: number[] };
export const emptyMemory = (): Memory => ({ snapshot: null, deadline_sent: [] });

export type Nudge = { kind: "deadline" | "arrived" | "prepared" | "peer" | "intro"; text: string; offer?: { word: "INTRO"; step: Step; with: string } };

export type ProactiveInput = {
  lang: Lang;
  analysis: Analysis;
  memory: Memory;
  /** Existing Action rows, for drafts that are written and not yet sent. */
  actions: { kind: string; state: string; draft_primary: string | null }[];
  letterUrl: (kind: string) => string;
  program: Program | null;
  metro: string | null;
  members: Member[];
  selfId?: string;
};

export const DEADLINE_STEPS = [45, 30, 14, 7, 3];
const RANK: Record<ReqState, number> = { missing: 0, unknown: 0, from_document: 1, checked: 2, official: 3 };
const DRAFT_LABEL: Partial<Record<ActionKind, CopyKey>> = {
  request_school_letter: "draft.request_school_letter",
  respond_ctc_letter: "draft.respond_ctc_letter",
  request_evaluation: "draft.request_evaluation",
  ask_ctc_question: "draft.ask_ctc_question",
};
const STEP_OF: Partial<Record<ActionKind, Step>> = { request_school_letter: "school_letter", request_evaluation: "evaluation", respond_ctc_letter: "ctc_reply", live_scan: "live_scan" };

export const snapshotOf = (a: Analysis): Snapshot => Object.fromEntries(a.requirements.map((r) => [r.rule_id, r.state]));

export function nudgesFor(i: ProactiveInput): { nudges: Nudge[]; memory: Memory } {
  const { lang, analysis: a } = i;
  const nudges: Nudge[] = [];
  const memory: Memory = { snapshot: snapshotOf(a), deadline_sent: [...i.memory.deadline_sent] };

  const daysLeft = a.next.days_left ?? null;
  const r21 = a.requirements.find((r) => r.rule_id === "R21");
  if (daysLeft !== null && daysLeft >= 0 && r21?.state === "missing") {
    const crossed = DEADLINE_STEPS.filter((d) => daysLeft <= d);
    const fresh = crossed.filter((d) => !memory.deadline_sent.includes(d));
    if (fresh.length) {
      nudges.push({ kind: "deadline", text: say(lang, "nudge.deadline", { days: daysLeft, date: fmtDate(lang, a.facts.get<string>("ctc_letter.date")) }) });
      memory.deadline_sent.push(...fresh);
    }
  }

  if (i.memory.snapshot) {
    for (const r of a.requirements) {
      const before = i.memory.snapshot[r.rule_id];
      if (before !== undefined && RANK[r.state] > RANK[before]) nudges.push({ kind: "arrived", text: say(lang, "nudge.arrived", { rule: ruleTitle(lang, r.rule_id), state: t(lang, `state.${r.state}`) }) });
    }
  }

  for (const x of i.actions) {
    const label = DRAFT_LABEL[x.kind as ActionKind];
    if (label && x.draft_primary && x.state === "not_started") nudges.push({ kind: "prepared", text: say(lang, "nudge.prepared", { draft: say(lang, label), url: i.letterUrl(x.kind) }) });
  }

  // Her open steps in the plan's order. The first one others from her program can speak to wins, timing and introduction together.
  const steps = [a.next.headline, ...a.next.also].map((k) => STEP_OF[k]).filter((s): s is Step => !!s);
  if (i.program && i.metro) {
    const { program, metro } = i;
    const withTiming = steps.find((s) => peerTiming(lang, i.members, program.id, metro, s) !== null);
    const step = withTiming ?? steps.find((s) => introCandidate(i.members, program.id, metro, s, i.selfId));
    if (step) {
      const line = peerTiming(lang, i.members, program.id, metro, step, daysLeft);
      if (line) nudges.push({ kind: "peer", text: line });
      const who = introCandidate(i.members, program.id, metro, step, i.selfId);
      if (who) nudges.push({ kind: "intro", text: introOffer(lang, step), offer: { word: "INTRO", step, with: who.id } });
    }
  }

  return { nudges, memory };
}

/**
 * What leads her next reply, at most two messages so the answer to what she asked still fits in Twilio's four.
 * First her case (deadline, what changed, what is ready), then the people (how long it took others, an introduction).
 */
export function lead(nudges: Nudge[]): string[] {
  const own = nudges.filter((n) => n.kind === "deadline" || n.kind === "arrived" || n.kind === "prepared").map((n) => n.text);
  const people = nudges.filter((n) => n.kind === "peer" || n.kind === "intro").map((n) => n.text);
  return [own.join(" "), people.join(" ")].filter(Boolean);
}
