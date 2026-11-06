import type { Program } from "@/data/programs";
import type { Lang } from "@/rules/types";
import { analysisOf, evaluateAndSync, loadCase, type LoadedCase } from "./case";
import { circlePosts, countLine, groupFor, groupName, seed, type Step } from "./circle";
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

/** Her WhatsApp group, by profession, country and state. Works with or without a recognised program. */
export const groupOf = (c: C) =>
  groupFor(seed().circles, { profession: c.intakeObj.profession, country_of_training: c.intakeObj.country_of_training, us_state: c.intakeObj.us_state });

export async function communityView(c: C, program: Program | null) {
  const lang = c.lang;
  const metro = metroFor(c.intakeObj.city);
  const group = groupOf(c);
  const s = await load();
  const me = memberOf(s, c.id);
  return {
    state: !group ? ("none" as const) : me?.chat_joined || me?.group_link_sent_at ? ("joined" as const) : ("open" as const),
    group_name: group ? groupName(lang, group) : null,
    group_link: group?.invite_link ?? null,
    count_line: program && metro ? countLine(lang, allMembers(s), program, metro, c.id) : null,
    chat_joined: !!me?.chat_joined,
    in_group: !!me?.group_link_sent_at,
    synthetic: seed().members.some((m) => m.synthetic),
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
  const header = await caseHeader(c);
  const group = groupOf(c);
  if (!group) return { header, ready: false as const };
  const program = programFor(c, analysisOf(c));
  const metro = metroFor(c.intakeObj.city);
  const s = await load();
  const me = memberOf(s, c.id);
  const today = new Date(`${header.today}T12:00:00Z`);
  return {
    header,
    ready: true as const,
    title: groupName(lang, group),
    chat_joined: !!me?.chat_joined,
    group_link: group.invite_link,
    posts: program && metro ? circlePosts(lang, program, allMembers(s), metro, today) : [],
    chat: me?.chat_joined ? s.chat.filter((m) => m.circle_id === group.id).slice(-100).map((m) => ({ id: m.id, mine: m.case_id === c.id, name: m.first_name, text: m.text, at: m.at })) : [],
    count_line: program && metro ? countLine(lang, allMembers(s), program, metro, c.id) : null,
  };
}

export type CommunityAction = "group" | "chat_join" | "chat_leave" | "leave" | "say";

/**
 * Each act is hers. Opening the WhatsApp group or joining the conversation in Earned also counts her, by program and
 * area only, because she has chosen to be found. LEAVE removes her from both and from every count.
 */
export async function communityAct(caseId: string, action: CommunityAction, text?: string) {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const group = groupOf(c);
  if (!group) throw new Error("bad_state");
  const program = programFor(c, analysisOf(c));
  const metro = metroFor(c.intakeObj.city);
  const first = c.intakeObj.first_name ?? c.first_name;
  const phone = await whatsappOf(c.id);

  await update((s) => {
    const me = memberOf(s, c.id);
    const base = { case_id: c.id, first_name: first, phone, program_id: program?.id ?? `group:${group.id}`, metro: metro ?? "", closed: closedSteps(c.actions), counted: true };
    if (action === "group") return void upsertMember(s, { ...base, group_link_sent_at: new Date().toISOString() });
    if (action === "chat_join") return void upsertMember(s, { ...base, chat_joined: true });
    if (action === "leave") {
      s.members = s.members.filter((m) => m.case_id !== c.id);
      return;
    }
    if (!me) throw new Error("bad_state");
    if (action === "chat_leave") return void upsertMember(s, { ...me, chat_joined: false });
    const body = (text ?? "").trim().slice(0, 1000);
    if (!body || !me.chat_joined) throw new Error("bad_value");
    s.chat.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, circle_id: group.id, case_id: c.id, first_name: first, text: body, at: new Date().toISOString() });
  });
  return action === "leave" ? portalView(caseId) : circleView(caseId);
}
