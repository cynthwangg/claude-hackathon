import crypto from "node:crypto";
import type { Lang } from "@/rules/types";
import { fmtDate } from "./i18n";
import { say } from "./copy";

/**
 * Section 34.1. Earned prepares everything up to the irreversible step and hands her the last tap.
 * A reply word counts only when the latest offer for that word asked for it within 24 hours.
 */
export const WORDS = ["SEND", "SENT", "PRINT", "YES", "JOIN", "INTRO", "POST", "LEAVE"] as const;
export type Word = (typeof WORDS)[number];

const ALIASES: Record<string, Word> = {
  SEND: "SEND", ENVIAR: "SEND", 发送: "SEND",
  SENT: "SENT", ENVIADO: "SENT", ENVIADA: "SENT", 已发送: "SENT",
  PRINT: "PRINT", IMPRIMIR: "PRINT", 打印: "PRINT",
  YES: "YES", SI: "YES", SÍ: "YES", 是: "YES", 好: "YES",
  JOIN: "JOIN", UNIRME: "JOIN", 加入: "JOIN",
  INTRO: "INTRO", 介绍: "INTRO",
  POST: "POST", PUBLICAR: "POST", 发布: "POST",
  LEAVE: "LEAVE", SALIR: "LEAVE", 退出: "LEAVE",
};

/** A single word reply, case and punctuation insensitive, in any of her languages. Anything longer is a normal message. */
export function wordOf(text: string): Word | null {
  const t = text.trim().replace(/[.!?¡¿。！？\s]+$/u, "").replace(/^[¡¿\s]+/u, "").toUpperCase();
  return ALIASES[t] ?? null;
}

export type Offer = {
  id: string;
  word: Word;
  /** What the word does, for example "mark_sent", "count_opt_in", "join_circle", "intro", "intro_volunteer". */
  kind: string;
  made_at: Date;
  /** sha256 of the exact text she was shown. The act is recorded with this hash, so what she agreed to is checkable. */
  text_hash: string;
  payload?: Record<string, unknown>;
};

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");

export function makeOffer(word: Word, kind: string, shownText: string, now: Date, payload?: Record<string, unknown>): Offer {
  return { id: `${kind}:${sha256(shownText).slice(0, 12)}:${now.getTime()}`, word, kind, made_at: now, text_hash: sha256(shownText), payload };
}

export type Match = { kind: "act"; offer: Offer } | { kind: "expired"; offer: Offer } | null;

/** The latest offer that asked for this word decides. Older than 24 hours, it is re-offered, never acted on. */
export function matchWord(text: string, offers: Offer[], now: Date): Match {
  const w = wordOf(text);
  if (!w) return null;
  const latest = offers.filter((o) => o.word === w).sort((a, b) => b.made_at.getTime() - a.made_at.getTime())[0];
  if (!latest) return null;
  return now.getTime() - latest.made_at.getTime() > WINDOW_MS ? { kind: "expired", offer: latest } : { kind: "act", offer: latest };
}

export type Party = "her" | "school" | "agency" | "office";
export type Method = "email" | "upload" | "mail" | "in_person";

export type ReceiptInput = { on: string; doc: string; pages: number | null; file_sha256: string; to: string; method: Method };

/** Section 31.4. In her language and in English, so she can hand it to anyone. */
export function receipt(lang: Lang, r: ReceiptInput): string {
  const line = (l: Lang) =>
    `${say(l, "receipt.line", { date: fmtDate(l, r.on), doc: r.doc, pages: r.pages === 1 ? say(l, "pages.one") : say(l, "pages.many", { n: r.pages ?? "?" }), hash: r.file_sha256.slice(0, 12), to: r.to, method: say(l, `method.${r.method}`) })} ${say(l, "receipt.why")}`;
  return lang === "en" ? line("en") : `${line(lang)}\n\n${line("en")}`;
}
