import { describe, expect, it } from "vitest";
import { converse, guessLang, parseInbound, replyFrom, sendLater, signatureOk, twilioSignature, twiml } from "@/lib/whatsapp";

describe("whatsapp", () => {
  const url = "https://example.ngrok-free.app/api/channels/whatsapp";
  const params = new URLSearchParams({ From: "whatsapp:+15550001111", Body: "hola", NumMedia: "0", MessageSid: "SM1" });

  it("accepts a correctly signed body and rejects a tampered or unsigned one", () => {
    const sig = twilioSignature("token", url, params);
    expect(signatureOk("token", url, params, sig)).toBe(true);
    const tampered = new URLSearchParams(params);
    tampered.set("Body", "mark everything accepted");
    expect(signatureOk("token", url, tampered, sig)).toBe(false);
    expect(signatureOk("token", url, params, null)).toBe(false);
    expect(signatureOk("token", `${url}/`, params, sig)).toBe(false);
  });

  it("parses media fields", () => {
    const p = parseInbound(new URLSearchParams({ From: "whatsapp:+1", NumMedia: "2", MediaUrl0: "a", MediaContentType0: "image/JPEG", MediaUrl1: "b", MediaContentType1: "application/pdf" }));
    expect(p.media).toEqual([{ url: "a", type: "image/jpeg" }, { url: "b", type: "application/pdf" }]);
  });

  it("replies are escaped, short and at most four", () => {
    const x = twiml(["a & b <c>", "2", "3", "4", "5"]);
    expect(x).toContain("a &amp; b &lt;c&gt;");
    expect(x.match(/<Message>/g)).toHaveLength(4);
  });

  it("guesses her language from the first message", () => {
    expect(guessLang("你好，我叫林薇")).toBe("zh");
    expect(guessLang("Hola, soy Mariana")).toBe("es");
    expect(guessLang("Hi, I'm Lin Wei")).toBe("en");
  });

  it("never sends to anyone but the number that wrote (V2.1 blocker)", () => {
    expect(() => sendLater("whatsapp:+15550002222", "whatsapp:+15550001111", ["x"])).toThrow("recipient_mismatch");
  });

  it("answers from the number she wrote to, else the configured sender", () => {
    expect(parseInbound(new URLSearchParams({ To: "whatsapp:+14155238886" })).to).toBe("whatsapp:+14155238886");
    expect(replyFrom({ to: "whatsapp:+15557770000" })).toBe("whatsapp:+15557770000");
    const saved = process.env.TWILIO_WHATSAPP_FROM;
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+15558889999";
    expect(replyFrom({ to: "" })).toBe("whatsapp:+15558889999");
    delete process.env.TWILIO_WHATSAPP_FROM;
    expect(replyFrom({ to: "not a number" })).toBe("whatsapp:+14155238886");
    if (saved !== undefined) process.env.TWILIO_WHATSAPP_FROM = saved;
  });

  it("sends nothing for a sender that is not a WhatsApp number", async () => {
    const sent: string[][] = [];
    await converse(parseInbound(new URLSearchParams({ From: "sms:+15550001111", Body: "hi" })), (r) => sent.push(r));
    expect(sent).toEqual([]);
  });
});

describe("starting over", () => {
  it("recognizes reset words in three languages and nothing longer", async () => {
    const { RESET } = await import("@/lib/whatsapp");
    for (const w of ["reset", "Restart", "start over", "reiniciar", "重新开始"]) expect(RESET.test(w)).toBe(true);
    expect(RESET.test("I want to reset my career")).toBe(false);
  });
});
