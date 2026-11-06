import type { Program } from "@/data/programs";
import type { Lang } from "@/rules/types";
import { analysisOf, evaluateAndSync, loadCase, type LoadedCase } from "./case";
import { circleFor, circlePosts, joinOffer, metroName, seed, type Step } from "./circle";
import { allMembers, load, memberOf, memoryOf, update, upsertMember, type ClosedStep } from "./communityStore";
import { say, sayL10n } from "./copy";
import { db } from "./db";
import type { Analysis } from "./engine/analyze";
import { joinList, t } from "./i18n";
import { lead, nudgesFor } from "./proactive";
import { checkProgram, matchProgram, metroFor } from "./programs";
import { caseHeader, weekView } from "./views";

/**
 * The case portal (web). Same case as WhatsApp, read-only use of the case core. What changed since she was last here,
 * what to do this week, what Earned already did for her, and the people from her program.
 */
type C = NonNullable<LoadedCase>;

const SANDBOX = "whatsapp:+14155238886";
const baseUrl = () => (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LEAD_TTL_MS = 10 * 60 * 1000;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STEP_OF: Record<string, Step> = { request_school_letter: "school_letter", request_evaluation: "evaluation", respond_ctc_letter: "ctc_reply", live_scan: "live_scan" };
const DONE_STATES = ["document_obtained", "submitted", "accepted"];

/** Steps she finished, from her own progress page. Whole weeks from when the step appeared to when she marked it done. */
export function closedSteps(actions: C["actions"]): ClosedStep[] {
  return actions.flatMap((x) => {
    const step = STEP_OF[x.kind];
    if (!step || !DONE_STATES.includes(x.state)) return [];
    const hist = JSON.parse(x.history) as { state: string; at: string }[];
    const doneAt = hist.find((h) => DONE_STATES.includes(h.state))?.at ?? hist[hist.length - 1]?.at;
    if (!doneAt) return [];
    const weeks = Math.max(1, Math.round((new Date(doneAt).getTime() - x.created_at.getTime()) / (7 * 86400000)));
    return [{ step, weeks, on: doneAt.slice(0, 10) }];
  });
}

/** Her program, from her documents first, then from what she wrote in the conversation. Deterministic. */
export function programFor(c: C, a: Analysis | null): Program | null {
  const text = c.history.filter((h) => h.role === "user").map((h) => h.text).join(" ");
  return matchProgram(a?.facts ?? null, { country_of_training: c.intakeObj.country_of_training, text });
}

async function whatsappOf(caseId: string) {
  const ch = await db.channel.findFirst({ where: { case_id: caseId, kind: "whatsapp" } }).catch(() => null);
  return ch?.address ?? null;
}

const waLink = (lang: Lang) => {
  const from = (process.env.TWILIO_WHATSAPP_FROM || SANDBOX).replace(/\D/g, "");
  return `https://wa.me/${from}?text=${encodeURIComponent(say(lang, "portal.wa_prefill"))}`;
};

export async function communityView(c: C, program: Program | null) {
  const lang = c.lang;
  const metro = metroFor(c.intakeObj.city);
  const s = await load();
  const me = memberOf(s, c.id);
  const members = allMembers(s);
  const base = { program: program ? sayL10n(lang, program.short) : null, metro: metro ? metroName(lang, metro) : null, counted: !!me?.counted, chat_joined: !!me?.chat_joined, synthetic: seed().members.some((m) => m.synthetic) };
  if (!program || !metro) return { ...base, state: "unknown" as const, count_line: null, offer: null, circle_url: null };
  const others = joinOffer(lang, members, program, metro, c.id);
  const circle = circleFor(seed().circles, program.id, metro);
  return {
    ...base,
    state: me?.counted ? ("counted" as const) : ("ask" as const),
    count_line: others?.[0] ?? null,
    offer: others?.[1] ?? null,
    has_group: !!circle?.invite_link,
    circle_url: `/c/${c.id}/circle`,
  };
}

export async function portalView(caseId: string) {
  const exists = await loadCase(caseId);
  if (!exists) throw new Error("case_not_found");
  const a = await evaluateAndSync(caseId);
  const c = (await loadCase(caseId))!;
  const lang = c.lang;
  const header = await caseHeader(c);
  const program = programFor(c, a);
  const metro = metroFor(c.intakeObj.city);
  const wa = await whatsappOf(c.id);

  const since = await update((s) => {
    const cached = s.lead[c.id];
    if (cached && Date.now() - new Date(cached.at).getTime() < LEAD_TTL_MS) return cached.lines;
    const me = memberOf(s, c.id);
    if (me) upsertMember(s, { ...me, closed: closedSteps(c.actions) });
    const r = nudgesFor({
      lang, analysis: a, memory: memoryOf(s, c.id), actions: c.actions,
      letterUrl: (k) => `${baseUrl()}/c/${c.id}/letter/${k}`, program, metro, members: allMembers(s), selfId: c.id,
    });
    s.memory[c.id] = r.memory;
    // The introduction is a WhatsApp reply word today; the web gets it as a button once introductions are stored.
    const lines = lead(r.nudges.filter((n) => n.kind !== "intro"));
    s.lead[c.id] = { at: new Date().toISOString(), lines };
    return lines;
  });

  const read = c.documents.filter((d) => d.status === "read");
  const did: string[] = [];
  if (read.length) did.push(say(lang, "portal.did.read", { docs: joinList(lang, Array.from(new Set(read.map((d) => t(lang, `noun.${d.kind}`))))) }));
  if (header.office) did.push(say(lang, "portal.did.office", { office: header.office.name }));
  if (program) {
    const chk = checkProgram(program, a.facts)[0];
    did.push(chk?.status === "confirmed" ? say(lang, "program.confirmed", { courses: joinList(lang, chk.found) }) : say(lang, "portal.did.program", { program: sayL10n(lang, program.short) }));
  }
  for (const x of c.actions) if (x.draft_primary) did.push(say(lang, "portal.did.letter", { draft: t(lang, `draft.${x.kind}`) }));

  return {
    header,
    connected: wa ? { whatsapp: `•••• ${wa.replace(/\D/g, "").slice(-4)}` } : { whatsapp: null },
    wa_link: waLink(lang),
    since,
    week: c.routing.kind === "none" ? null : weekView(c, a),
    did,
    community: await communityView(c, program),
  };
}

export async function circleView(caseId: string) {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const lang = c.lang;
  const program = programFor(c, analysisOf(c));
  const metro = metroFor(c.intakeObj.city);
  const header = await caseHeader(c);
  if (!program || !metro) return { header, ready: false as const };
  const s = await load();
  const me = memberOf(s, c.id);
  const circle = circleFor(seed().circles, program.id, metro);
  const circleId = circle?.id ?? `${program.id}.${metro}`;
  const today = new Date(`${header.today}T12:00:00Z`);
  return {
    header,
    ready: true as const,
    title: capitalize(say(lang, "circle.title", { program: sayL10n(lang, program.short), metro: metroName(lang, metro) })),
    counted: !!me?.counted,
    chat_joined: !!me?.chat_joined,
    has_group: !!circle?.invite_link,
    group_link: me?.group_link_sent_at && circle?.invite_link ? circle.invite_link : null,
    posts: circlePosts(lang, program, allMembers(s), metro, today),
    chat: me?.chat_joined ? s.chat.filter((m) => m.circle_id === circleId).slice(-100).map((m) => ({ id: m.id, mine: m.case_id === c.id, name: m.first_name, text: m.text, at: m.at })) : [],
    count_line: joinOffer(lang, allMembers(s), program, metro, c.id)?.[0] ?? null,
    circle_id: circleId,
  };
}

export type CommunityAction = "count" | "leave" | "chat_join" | "chat_leave" | "group" | "say";

/** Every opt-in is its own act. Joining the chat or the group needs being counted first, so consent is always stepwise. */
export async function communityAct(caseId: string, action: CommunityAction, text?: string) {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const program = programFor(c, analysisOf(c));
  const metro = metroFor(c.intakeObj.city);
  if (!program || !metro) throw new Error("bad_state");
  const first = c.intakeObj.first_name ?? c.first_name;
  const phone = await whatsappOf(c.id);
  const circle = circleFor(seed().circles, program.id, metro);
  const circleId = circle?.id ?? `${program.id}.${metro}`;

  await update((s) => {
    const me = memberOf(s, c.id);
    const base = { case_id: c.id, first_name: first, phone, program_id: program.id, metro, closed: closedSteps(c.actions) };
    if (action === "count") return void upsertMember(s, { ...base, counted: true });
    if (action === "leave") {
      s.members = s.members.filter((m) => m.case_id !== c.id);
      return;
    }
    if (!me?.counted) throw new Error("bad_state");
    if (action === "chat_join") return void upsertMember(s, { ...me, chat_joined: true });
    if (action === "chat_leave") return void upsertMember(s, { ...me, chat_joined: false });
    if (action === "group") return void upsertMember(s, { ...me, group_link_sent_at: new Date().toISOString() });
    if (action === "say") {
      const body = (text ?? "").trim().slice(0, 1000);
      if (!body || !me.chat_joined) throw new Error("bad_value");
      s.chat.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, circle_id: circleId, case_id: c.id, first_name: first, text: body, at: new Date().toISOString() });
    }
  });
  return action === "say" || action === "chat_join" || action === "chat_leave" || action === "group" ? circleView(caseId) : portalView(caseId);
}

