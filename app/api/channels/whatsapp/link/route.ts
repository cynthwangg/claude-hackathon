import { NextResponse } from "next/server";

/**
 * The WhatsApp link for the landing page (public/landing.html), which is static and cannot read .env.
 * Opens a chat with the Bridge number with a greeting already typed, so sending it starts the flow with the welcome.
 * Phones that have never joined the Twilio sandbox must send the join phrase first; set TWILIO_SANDBOX_JOIN
 * (for example "join silver-tiger") and the link types that instead. After Twilio confirms, she says hi.
 */
const GREETING: Record<string, string> = { en: "Hi Bridge", es: "Hola Bridge", zh: "你好 Bridge" };

export function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get("lang") ?? "en";
  const number = (process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886").replace(/\D/g, "");
  const text = process.env.TWILIO_SANDBOX_JOIN?.trim() || GREETING[lang] || GREETING.en;
  return NextResponse.json({ url: `https://wa.me/${number}?text=${encodeURIComponent(text)}` });
}
