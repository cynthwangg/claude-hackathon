import { describe, expect, it } from "vitest";
import { guessLang, parseInbound, sendLater, signatureOk, twilioSignature, twiml } from "@/lib/whatsapp";

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
});
