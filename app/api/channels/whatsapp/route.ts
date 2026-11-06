import { after } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { inbound, parseInbound, sendLater, signatureOk, twiml } from "@/lib/whatsapp";

export const maxDuration = 120;

const xml = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });

/**
 * D25. One endpoint, the same case core as the web. Signed requests only when TWILIO_AUTH_TOKEN is set.
 * Without a token it accepts requests addressed to localhost only, so curl works and a tunnel without a token does not.
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
    const { replies, later } = await inbound(msg);
    const canSendLater = !!(process.env.TWILIO_ACCOUNT_SID && token);

    if (later && !canSendLater) return xml(twiml([...replies, ...(await later)].slice(0, 4)));
    if (later) {
      after(async () => {
        const out = await later.catch(() => [] as string[]);
        const channel = await db.channel.findUnique({ where: { address: msg.from } });
        if (channel && out.length) {
          await db.message.createMany({ data: out.map((body) => ({ channel_id: channel.id, direction: "out", body })) });
          sendLater(msg.from, channel.address, out);
        }
      });
    }
    const channel = await db.channel.findUnique({ where: { address: msg.from } });
    if (channel && replies.length) await db.message.createMany({ data: replies.map((body) => ({ channel_id: channel.id, direction: "out", body })) });
    return xml(twiml(replies));
  });
}
