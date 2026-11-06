import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";

/** docs/whatsapp.md "Test without Twilio", plus the D25 reviewer checks, against the production server. */
let media: http.Server;
let mediaBase = "";
test.beforeAll(async () => {
  media = http.createServer((req, res) => {
    const name = path.basename(req.url ?? "");
    const file = path.join(process.cwd(), "fixtures", "mariana", name);
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader("Content-Type", name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".ogg") ? "audio/ogg" : "image/jpeg");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((r) => media.listen(0, "127.0.0.1", r));
  mediaBase = `http://127.0.0.1:${(media.address() as AddressInfo).port}`;
});
test.afterAll(() => media.close());

const post = (request: APIRequestContext, form: Record<string, string>, headers: Record<string, string> = {}) =>
  request.post("/api/channels/whatsapp", { form, headers });
const messages = (xml: string) => [...xml.matchAll(/<Message>([\s\S]*?)<\/Message>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

test("WhatsApp runs the same intake and reading as the web", async ({ request }) => {
  const from = `whatsapp:+1555${Date.now().toString().slice(-7)}`;
  const r1 = await post(request, { From: from, NumMedia: "0", MessageSid: `SM${Date.now()}a`, Body: "Hola, soy Mariana. Fui maestra de primaria en Guadalajara, México, diez años. Tengo mi cédula profesional. Vivo en San José. Mandé la solicitud a la CTC y me regresaron una carta que no entiendo." });
  expect(r1.status()).toBe(200);
  const m1 = messages(await r1.text());
  expect(m1.join("\n")).toContain("Commission on Teacher Credentialing");
  expect(m1[m1.length - 1]).toContain("Primero, la carta de la CTC.");
  expect(m1.length).toBeLessThanOrEqual(4);

  const sid = `SM${Date.now()}b`;
  const r2 = await post(request, { From: from, NumMedia: "1", MessageSid: sid, MediaUrl0: `${mediaBase}/06-ctc-letter-returned.pdf`, MediaContentType0: "application/pdf", Body: "" });
  const m2 = messages(await r2.text());
  expect(m2[0]).toBe("Leyendo. Un momento.");
  expect(m2.join("\n")).toContain("Esto es lo que leí en la carta de la CTC.");
  expect(m2.join("\n")).toMatch(/\/c\/[a-z0-9]+\/position/);
  const caseId = m2.join("\n").match(/\/c\/([a-z0-9]+)\/position/)![1];

  const again = await post(request, { From: from, NumMedia: "1", MessageSid: sid, MediaUrl0: `${mediaBase}/06-ctc-letter-returned.pdf`, MediaContentType0: "application/pdf", Body: "" });
  expect(messages(await again.text())).toEqual([]);

  const voice = await post(request, { From: from, NumMedia: "1", MessageSid: `SM${Date.now()}c`, MediaUrl0: `${mediaBase}/note.ogg`, MediaContentType0: "audio/ogg", Body: "" });
  expect(messages(await voice.text()).join("\n")).toContain("notas de voz");

  const docs = await (await request.get(`/api/cases/${caseId}/documents`)).json();
  expect(docs.documents.length).toBe(1);

  const other = `whatsapp:+1556${Date.now().toString().slice(-7)}`;
  const r3 = await post(request, { From: other, NumMedia: "0", MessageSid: `SM${Date.now()}d`, Body: "Hi" });
  expect(messages(await r3.text()).join("\n")).not.toContain("Mariana");
});

test("a request through a tunnel without a token is refused", async ({ request }) => {
  const r = await post(request, { From: "whatsapp:+15550001111", NumMedia: "0", Body: "Hi" }, { Host: "abc.ngrok-free.app" });
  expect(r.status()).toBe(403);
});
