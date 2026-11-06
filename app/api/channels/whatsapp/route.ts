import { after } from "next/server";
import { handle } from "@/lib/http";
import { t } from "@/lib/i18n";
import { converse, guessLang, parseInbound, replyFrom, sendLater, signatureOk, twiml } from "@/lib/whatsapp";

export const maxDuration = 120;

const xml = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });

/** Twilio gives up on a webhook after about 15 seconds; answer inside that. */
const TWIML_BUDGET_MS = 12_000;

/**
 * D25. One endpoint, the same case core as the web. Signed requests only when TWILIO_AUTH_TOKEN is set.
 * Without a token it accepts requests addressed to localhost only, so curl works and a tunnel without a token does not.
 *
 * Replies go back as TwiML by default. That works on any account, including one whose REST sending is blocked
 * until Twilio's KYC review (error 20003, "Primary compliance profile is not approved"). If the work takes longer
 * than Twilio waits, she gets what is ready plus a line asking her to write again, and the work finishes in the background.
 * TWILIO_REPLY_MODE=rest (with SID and token) answers Twilio at once and sends every reply through the REST API instead.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (token) {
      const url = process.env.PUBLIC_WEBHOOK_URL ?? req.url;
      if (!signatureOk(token, url, params, req.headers.get("x-twilio-signature"))) return xml(twiml([]), 403);
    } else {
      const host = (req.headers.get("host") ?? "").split(":")[0];
      if (!["localhost", "127.0.0.1"].includes(host)) return xml(twiml([]), 403);
    }

    const msg = parseInbound(params);

    if (process.env.TWILIO_REPLY_MODE === "rest" && process.env.TWILIO_ACCOUNT_SID && token) {
      const from = replyFrom(msg);
      after(() => converse(msg, (replies, address) => sendLater(msg.from, address, replies, from)));
      return xml(twiml([]));
    }

    const out: string[] = [];
    const work = converse(msg, (replies) => out.push(...replies));
    const late = await Promise.race([work.then(() => false), new Promise<boolean>((r) => setTimeout(() => r(true), TWIML_BUDGET_MS))]);
    if (late) {
      after(() => work);
      return xml(twiml([...out, t(guessLang(msg.body), "wa.slow")]));
    }
    return xml(twiml(out));
  });
}
