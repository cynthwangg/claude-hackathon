import { analysisOf, intakeMessage, loadCase, type LoadedCase } from "./case";
import { db } from "./db";
import { guardModelText } from "./guard";
import { guessLang, t } from "./i18n";
import { missingRequired, type Intake, type Turn } from "./intake/types";
import { provider } from "./model";
import type { Topic } from "./model/types";
import type { Lang } from "@/rules/types";
import { caseHeader, positionView, weekView } from "./views";

/**
 * The one agent. The web "Ask" page and WhatsApp both call agentTurn, and both read and write the same thread
 * (Case.history), so a conversation started on her phone continues on the web and back.
 *
 * Order of decisions, all in code, none by the model:
 * 1. "hi" or a message with nothing about her situation: Claude answers conversationally and asks about her (Mela's coach style).
 * 2. A message with her story, even partial: the intake reads it and asks only for what is missing. That part is unchanged.
 * 3. MENU shows the numbered menu (Mela's, with her case as option 1); a number right after it picks a topic.
 * 4. On a coach topic (roles, visa, resume) Claude answers as the coach, with her case file as context.
 * 5. After the intake, anything she asks gets a short answer about her case, from her case file.
 */

export type Channel = "web" | "whatsapp";
export type AgentReply = { kind: "menu" | "intake" | "intake_done" | "chat"; say: string | null; topic: Topic | "menu" | null };

const MENU_WORDS = /^(menu|men[uú]|options|opciones|菜单|选项)[\s.!?¡¿。！？]*$/i;
const GREETING = /^[¡\s]*(hi|hii+|hello|hey|yo|start|get started|good (morning|afternoon|evening)|hola|buenas( tardes| noches| días)?|buenos días|inicio|empezar|你好|您好|嗨|开始)( there)?([\s,，]*(bridge))?[\s.!?¡¿。！？,，]*$/i;
const PICKS: Record<string, Topic> = { "1": "case", "2": "roles", "3": "visa", "4": "resume" };
const COACH: Topic[] = ["roles", "visa", "resume"];
const MAX_TURNS = 80;

export type Input = { text?: string | null; pick?: Topic | "menu" | null };

/** Pure, so it is tested without a database. */
const LANG_WORDS: [RegExp, Lang][] = [
  [/^(english|inglés|ingles|英文|英语|英語)$/i, "en"],
  [/^(español|espanol|spanish|castellano|西班牙语|西班牙文)$/i, "es"],
  [/^(中文|普通话|汉语|chinese|mandarin|chino|mandarín)$/i, "zh"],
];

export function decide(input: Input, topic: string | null): { kind: "menu" } | { kind: "lang"; lang: Lang; text: string } | { kind: "greeting"; text: string } | { kind: "pick"; topic: Topic } | { kind: "text"; text: string } | { kind: "none" } {
  if (input.pick === "menu") return { kind: "menu" };
  if (input.pick) return { kind: "pick", topic: input.pick };
  const text = (input.text ?? "").trim();
  if (!text) return { kind: "none" };
  const bare = text.replace(/[\s.!?¡¿。！？,，]+$/g, "").replace(/^(in|en)\s+|^用/i, "");
  const chosen = LANG_WORDS.find(([re]) => re.test(bare));
  if (chosen) return { kind: "lang", lang: chosen[1], text };
  if (MENU_WORDS.test(text)) return { kind: "menu" };
  if (GREETING.test(text)) return { kind: "greeting", text };
  if (topic === "menu" && PICKS[text.replace(/[.)\s]/g, "")]) return { kind: "pick", topic: PICKS[text.replace(/[.)\s]/g, "")] };
  return { kind: "text", text };
}

/** Whether anything she said describes her situation. A name, a language or a worry alone does not. */
export function knowsHerSituation(i: Intake): boolean {
  return [i.profession, i.profession_words, i.country_of_training, i.us_state, i.city, i.years_experience, i.has_foreign_license, i.stage, i.level].some((v) => v !== null && v !== undefined && v !== "") || i.holds.length > 0;
}

const baseUrl = () => (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function save(caseId: string, history: Turn[], topic: string | null) {
  await db.case.update({ where: { id: caseId }, data: { history: JSON.stringify(history.slice(-MAX_TURNS)), topic } });
}

/** Everything the agent may know about her, written from the same views the screens use. Nothing else reaches the model. */
export async function caseBrief(c: NonNullable<LoadedCase>): Promise<string> {
  const h = await caseHeader(c);
  const i = c.intakeObj;
  const lines = [
    `Name ${h.name ?? "not given"}. Language ${c.lang}.`,
    `What she told us ${JSON.stringify(Object.fromEntries(Object.entries(i).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length))))}`,
    h.office ? `The office that decides ${h.office.name}, ${h.office.url}` : "The office that decides is not known yet, because her state is not known.",
    `Route ${c.routing.kind === "match" ? "fully mapped in Bridge" : c.routing.kind === "near" ? "partly mapped in Bridge" : "not mapped in Bridge, the office decides everything"}. ${h.pathway ? `${h.pathway.title}. ${h.pathway.orientation}` : h.general_orientation}`,
    `Documents read ${c.documents.filter((d) => d.status === "read").map((d) => d.kind).join(", ") || "none yet"}.`,
    `Her case on the web ${baseUrl()}/c/${c.id}/position . Upload documents at ${baseUrl()}/c/${c.id}/documents`,
  ];
  if (!missingRequired(i).length) {
    try {
      const a = analysisOf(c);
      const p = positionView(c, a);
      const w = weekView(c, a);
      const list = (xs: { text: string }[]) => (xs.length ? xs.map((x) => `- ${x.text}`).join("\n") : "- none");
      lines.push(
        `She already has (state words are the product's, not the office's decision)\n${list([...p.have, ...p.extra_have])}`,
        `Still needed\n${list(p.needed)}`,
        `We can't tell yet\n${list(p.unknown)}`,
        `Later, after the preliminary credential\n${list(p.later)}`,
        `This week's action ${w.headline.text}. ${w.headline.why}${w.why_now ? ` ${w.why_now}` : ""}`,
      );
    } catch {
      /* the brief stays useful without the analysis */
    }
  }
  return lines.join("\n");
}

export async function agentTurn(caseId: string, input: Input, channel: Channel = "web"): Promise<AgentReply> {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const lang = c.lang;
  const intakeDone = missingRequired(c.intakeObj).length === 0;
  const d = decide(input, c.topic);
  const history = c.history;

  if (d.kind === "none") return { kind: "chat", say: null, topic: (c.topic as AgentReply["topic"]) ?? null };

  // She picks her language by writing its name. Everything after this, from the agent and the screens, is in that language.
  if (d.kind === "lang") {
    const next = d.lang;
    const follow = intakeDone ? t(next, channel === "whatsapp" ? "agent.case_ready_wa" : "agent.case_ready_web", { where: t(next, "nav.where") }) : knowsHerSituation(c.intakeObj) ? t(next, "agent.lang_continue") : t(next, "agent.case_start");
    const say = `${t(next, "agent.lang_set")}\n\n${follow}`;
    await db.case.update({ where: { id: c.id }, data: { language: next } });
    await save(c.id, [...history, { role: "user", text: d.text }, { role: "assistant", text: say }], c.topic);
    return { kind: "chat", say, topic: (c.topic as AgentReply["topic"]) ?? null };
  }

  if (d.kind === "menu") {
    const say = t(lang, "agent.menu", { url: `${baseUrl()}/c/${c.id}/position` });
    await save(c.id, [...history, ...(input.text ? [{ role: "user" as const, text: input.text }] : []), { role: "assistant", text: say }], "menu");
    return { kind: "menu", say, topic: "menu" };
  }

  if (d.kind === "pick") {
    const label = t(lang, `agent.topic.${d.topic}`);
    if (d.topic === "case") {
      const say = intakeDone ? t(lang, channel === "whatsapp" ? "agent.case_ready_wa" : "agent.case_ready_web", { where: t(lang, "nav.where") }) : t(lang, "agent.case_start");
      await save(c.id, [...history, { role: "user", text: label }, { role: "assistant", text: say }], null);
      return { kind: intakeDone ? "chat" : "intake", say, topic: null };
    }
    return chat(c, [...history, { role: "user", text: label }], d.topic);
  }

  const turnText = d.text;
  const topic = c.topic as Topic | "menu" | null;
  const knewBefore = knowsHerSituation(c.intakeObj);

  // "hi" before she has said anything about herself: Claude greets her and asks, like Mela's coach. No intake call, so it is quick.
  // A hello before she has said anything about herself (often her first message, from the landing page): the Bridge welcome, fixed text, instant.
  if (d.kind === "greeting" && !knewBefore && !intakeDone) {
    const say = t(lang, "agent.welcome");
    await save(c.id, [...history, { role: "user", text: turnText }, { role: "assistant", text: say }], null);
    return { kind: "chat", say, topic: null };
  }
  if (d.kind === "greeting" && intakeDone) return chat(c, [...history, { role: "user", text: turnText }], "case");

  if (topic && COACH.includes(topic as Topic)) return chat(c, [...history, { role: "user", text: turnText }], topic as Topic);

  if (!intakeDone) {
    if (topic === "menu") await db.case.update({ where: { id: c.id }, data: { topic: null } });
    // Before she has told us anything, the language she writes her story in becomes the case language.
    const wrote = guessLang(turnText);
    if (!knewBefore && wrote !== "en" && wrote !== c.lang) await db.case.update({ where: { id: c.id }, data: { language: wrote } });
    const r = await intakeMessage(c.id, turnText);
    // Nothing about her situation in what she wrote ("what is this", "can you help me find a job"): Claude answers it
    // in general terms and asks about her. A story, even a partial one, stays in the intake, which asks only for what is missing.
    if (!knewBefore && !r.done && !knowsHerSituation(r.intake)) return chat(c, [...history, { role: "user", text: turnText }], "general", r.language);
    return { kind: r.done ? "intake_done" : "intake", say: r.say, topic: null };
  }
  return chat(c, [...history, { role: "user", text: turnText }], "case");
}

async function chat(c: NonNullable<LoadedCase>, turns: Turn[], topic: Topic, lang: Lang = c.lang): Promise<AgentReply> {
  const raw = await provider().chatTurn(lang, turns, await caseBrief(c), topic);
  const say = guardModelText(raw) ?? t(lang, "agent.cannot_say");
  const keep = COACH.includes(topic) ? topic : null;
  await save(c.id, [...turns, { role: "assistant", text: say }], keep);
  return { kind: "chat", say, topic: keep };
}
