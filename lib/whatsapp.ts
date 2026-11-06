import crypto from "node:crypto";
import type { Lang } from "@/rules/types";
import { analysisOf, createCase, ingestDocument, intakeMessage, loadCase, ACCEPTED_MIME } from "./case";
import { db } from "./db";
import { fmtDate, t } from "./i18n";
import { requestOrder } from "./intake/router";
import { positionView, weekView, caseHeader } from "./views";

/** Twilio's webhook form fields that the product uses. */
export type Inbound = { from: string; body: string; numMedia: number; media: { url: string; type: string }[]; sid: string | null };

export function parseInbound(form: URLSearchParams): Inbound {
  const n = Number(form.get("NumMedia") ?? "0") || 0;
  const media = Array.from({ length: Math.min(n, 10) }, (_, i) => ({ url: form.get(`MediaUrl${i}`) ?? "", type: (form.get(`MediaContentType${i}`) ?? "").toLowerCase() })).filter((m) => m.url);
  return { from: form.get("From") ?? "", body: (form.get("Body") ?? "").trim(), numMedia: n, media, sid: form.get("MessageSid") };
}

/** X-Twilio-Signature. HMAC-SHA1 of the exact public URL plus the sorted POST parameters, keyed with the auth token. */
export function twilioSignature(token: string, url: string, params: URLSearchParams) {
  const keys = [...new Set(params.keys())].sort();
  const data = url + keys.map((k) => k + params.getAll(k).join("")).join("");
  return crypto.createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64");
}

export function signatureOk(token: string, url: string, params: URLSearchParams, header: string | null) {
  if (!header) return false;
  const expected = Buffer.from(twilioSignature(token, url, params));
  const got = Buffer.from(header);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const twiml = (messages: string[]) => `<?xml version="1.0" encoding="UTF-8"?><Response>${messages.slice(0, 4).map((m) => `<Message>${esc(m.slice(0, 1600))}</Message>`).join("")}</Response>`;

/** A first guess at her language from the first message, before the intake model confirms it. */
export function guessLang(text: string): Lang {
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[ñáéíóú¿¡]|\b(hola|soy|maestra|tengo|vivo|estudi[eé]|años|carta)\b/i.test(text)) return "es";
  return "en";
}

const baseUrl = () => (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const webLink = (caseId: string) => `${baseUrl()}/c/${caseId}/position`;

async function channelFor(address: string, firstText: string) {
  const existing = await db.channel.findUnique({ where: { address } });
  if (existing) {
    await db.channel.update({ where: { id: existing.id }, data: { last_inbound: new Date() } });
    return { channel: existing, isNew: false };
  }
  const c = await createCase(guessLang(firstText));
  const channel = await db.channel.create({ data: { case_id: c.id, kind: "whatsapp", address } });
  return { channel, isNew: true };
}

async function requestLine(caseId: string): Promise<string | null> {
  const c = await loadCase(caseId);
  if (!c) return null;
  const read = new Set(c.documents.filter((d) => d.status === "read").map((d) => (d.kind === "practicum_record" ? "experience" : d.kind)));
  const next = requestOrder(c.intakeObj, c.routing.kind).find((k) => !read.has(k));
  if (!next) return null;
  const noun = t(c.lang, next === "license" && c.routing.kind === "none" ? "noun.license_generic" : `noun.${next}`);
  const looks = t(c.lang, `ask.${next}.looks`);
  return `${t(c.lang, read.size ? "docs.next" : "docs.first", { noun })} ${looks.startsWith("ask.") ? "" : looks} ${t(c.lang, "wa.send_photo")}`.replace(/\s+/g, " ").trim();
}

/** Turns for text she sends. The same intake as the web; nothing else to write for WhatsApp. */
export async function handleText(caseId: string, text: string): Promise<string[]> {
  const r = await intakeMessage(caseId, text);
  const c = (await loadCase(caseId))!;
  const lang = c.lang;
  if (!r.done) return [r.say ?? t(lang, "error.generic")];
  const h = await caseHeader(c);
  const office = h.office ? `${t(lang, "office.title")} · ${h.office.name} · ${h.office.url}` : t(lang, "office.unknown_state");
  const orientation = h.pathway?.orientation ?? h.general_orientation;
  const ask = await requestLine(caseId);
  return [office, orientation, ask ?? t(lang, "wa.link", { url: webLink(caseId) })].filter(Boolean);
}

/** Downloads Twilio media with Basic auth, then the same reading pipeline as a web upload. */
export async function handleMedia(caseId: string, media: { url: string; type: string }[]): Promise<string[]> {
  const c = (await loadCase(caseId))!;
  const lang = c.lang;
  const out: string[] = [];
  for (const m of media) {
    if (m.type.startsWith("audio/")) { out.push(t(lang, "wa.voice_declined")); continue; }
    if (!ACCEPTED_MIME.includes(m.type)) { out.push(t(lang, "wa.unsupported")); continue; }
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const res = await fetch(m.url, { redirect: "follow", headers: sid && token ? { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` } : {} });
    if (!res.ok) { out.push(t(lang, "docs.unreadable")); continue; }
    const bytes = Buffer.from(await res.arrayBuffer());
    const ext = m.type === "application/pdf" ? "pdf" : "jpg";
    const base = (() => { try { return new URL(m.url).pathname.split("/").pop() || "whatsapp"; } catch { return "whatsapp"; } })();
    const name = /\.(pdf|jpe?g|png|webp)$/i.test(base) ? base : `${base}.${ext}`;
    const doc = await ingestDocument(caseId, { bytes, mime: m.type, name }, null).catch(() => null);
    if (!doc || doc.status !== "read") { out.push(t(lang, "docs.unreadable")); continue; }
    const lines = doc.facts
      .filter((f) => !/\.present$|^transcript\.courses$|\.extra\.|lists_courses|documents_reviewed|ctc_letter\.items/.test(f.key))
      .slice(0, 6)
      .map((f) => `${t(lang, `label.${f.key}`)} · ${Array.isArray(f.value) ? (f.value as string[]).filter((x) => /trabajo docente|pr[aá]ctica|实习|practicum|student teaching/i.test(x)).join(", ") || `${(f.value as string[]).length}` : typeof f.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.value) ? fmtDate(lang, f.value) : String(f.value)}`);
    out.push([t(lang, "docs.header", { noun: t(lang, `noun.${doc.kind}`) }), ...lines, t(lang, "wa.fix")].join("\n"));
  }
  if (out.some((x) => x.includes("\n"))) out.push(await statusMessage(caseId));
  return out.slice(0, 4);
}

/** Where she stands, short, with the same state words as the web, and the link to the same case. */
export async function statusMessage(caseId: string): Promise<string> {
  const c = (await loadCase(caseId))!;
  const lang = c.lang;
  const a = analysisOf(c);
  const p = positionView(c, a);
  const w = weekView(c, a);
  const ask = await requestLine(caseId);
  const have = [...p.have.map((l) => l.text), ...p.extra_have.map((x) => x.text)].slice(0, 3);
  const needed = p.needed.slice(0, 3).map((l) => l.text.split(". ")[0]);
  const parts = [
    have.length ? `${t(lang, "position.have")}\n${have.map((x) => `· ${x}`).join("\n")}` : null,
    needed.length ? `${t(lang, "position.needed")}\n${needed.map((x) => `· ${x}`).join("\n")}` : null,
    ask ?? (c.routing.kind === "none" ? null : `${t(lang, "week.title")} · ${w.headline.text}`),
    t(lang, "wa.link", { url: webLink(caseId) }),
  ].filter(Boolean);
  return parts.join("\n\n");
}

/** Replies after the webhook returned, through the REST API, only to the number that wrote. One every three seconds. */
const queues = new Map<string, Promise<void>>();
export function sendLater(to: string, channelAddress: string, messages: string[]) {
  if (to !== channelAddress) throw new Error("recipient_mismatch");
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
  if (!sid || !token) return;
  const prev = queues.get(to) ?? Promise.resolve();
  const next = prev.then(async () => {
    for (const body of messages.slice(0, 4)) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: from, To: to, Body: body.slice(0, 1600) }),
      }).catch(() => null);
      await new Promise((r) => setTimeout(r, 3000));
    }
  });
  queues.set(to, next.catch(() => undefined));
}

export async function inbound(msg: Inbound): Promise<{ replies: string[]; later?: Promise<string[]> }> {
  if (!/^whatsapp:\+\d{6,16}$/.test(msg.from)) return { replies: [] };
  if (msg.sid) {
    const seen = await db.message.findUnique({ where: { provider_id: msg.sid } });
    if (seen) return { replies: [] };
  }
  const { channel } = await channelFor(msg.from, msg.body);
  await db.message.create({ data: { channel_id: channel.id, direction: "in", body: msg.body || null, media_type: msg.media[0]?.type ?? null, provider_id: msg.sid } });
  const c = (await loadCase(channel.case_id))!;

  if (msg.media.length) {
    const work = handleMedia(c.id, msg.media);
    return { replies: [t(c.lang, "wa.reading")], later: work };
  }
  if (!msg.body) return { replies: [] };
  if (/^(why|por qu[eé]|为什么)\??$/i.test(msg.body)) return { replies: [t(c.lang, "wa.why_web", { url: webLink(c.id) })] };
  if (/^(status|estado|进展|dónde estoy)\??$/i.test(msg.body) && c.documents.length) return { replies: [await statusMessage(c.id)] };
  return { replies: await handleText(c.id, msg.body) };
}
