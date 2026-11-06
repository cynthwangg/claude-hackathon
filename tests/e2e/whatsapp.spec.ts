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
  // One short handoff with the link to the document page, not a wall of agency names.
  expect(m1).toHaveLength(1);
  expect(m1[0]).toContain("Gracias, Mariana.");
  expect(m1[0]).toMatch(/Empieza aquí\n\S+\/c\/[a-z0-9]+\/documents/);
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

test("one agent, one thread: menu and coach on WhatsApp continue on the web", async ({ request }) => {
  const from = `whatsapp:+1557${Date.now().toString().slice(-7)}`;
  const sid = (x: string) => `SM${Date.now()}${x}`;
  // "hi" gets the Bridge welcome, which asks about her, not a canned menu.
  const hi = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("h"), Body: "hi" })).text());
  expect(hi[0]).toContain("Welcome to Bridge");
  expect(hi[0]).toContain("where did you train");
  // A question with no story in it is answered the same way.
  const q = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("q"), Body: "what is this?" })).text());
  expect(q[0]).toContain("topic general");

  const menu = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("m"), Body: "menu" })).text());
  expect(menu[0]).toContain("1  Your credential case");
  const link = menu[0].match(/\/c\/([a-z0-9]+)\/position/);
  expect(link).not.toBeNull();
  const caseId = link![1];

  const coach = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("r"), Body: "2" })).text());
  expect(coach[0]).toContain("topic roles");
  const follow = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("f"), Body: "I also speak Spanish" })).text());
  expect(follow[0]).toContain("topic roles");

  // The web sees the same thread and continues it.
  const web = await (await request.post(`/api/cases/${caseId}/agent`, { data: { pick: "visa" } })).json();
  expect(web.history.map((h: { text: string }) => h.text)).toEqual(expect.arrayContaining(["hi", "menu", "Work that fits my experience", "I also speak Spanish", "Visas and work rights"]));
  expect(web.reply.say).toContain("topic visa");

  // Back on WhatsApp, the topic the web picked holds.
  const back = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("b"), Body: "Can I work while I wait?" })).text());
  expect(back[0]).toContain("topic visa");

  // Option 1 returns to her case, and the next message goes to the intake.
  await post(request, { From: from, NumMedia: "0", MessageSid: sid("n"), Body: "menu" });
  const one = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("o"), Body: "1" })).text());
  expect(one[0]).toContain("Tell me where you are");
  const intake = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("i"), Body: "Hi, I'm Lin Wei. I taught middle school in Hangzhou, China for eight years. I live in Oakland. I have my diploma and my teacher certificate. I don't know where to start." })).text());
  expect(intake.join("\n")).toContain("Start here");
});

test("reset starts a fresh case with the welcome, and a Spanish story after it is answered in Spanish", async ({ request }) => {
  const from = `whatsapp:+1558${Date.now().toString().slice(-7)}`;
  const sid = (x: string) => `SM${Date.now()}${x}`;
  await post(request, { From: from, NumMedia: "0", MessageSid: sid("a"), Body: "Hi, I'm Lin Wei. I taught middle school in Hangzhou, China for eight years. I live in Oakland. I have my diploma and my teacher certificate. I don't know where to start." });
  const reset = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("r"), Body: "reset" })).text());
  expect(reset[0]).toContain("Welcome to Bridge");
  const es = messages(await (await post(request, { From: from, NumMedia: "0", MessageSid: sid("s"), Body: "Hola, soy Mariana. Fui maestra de primaria en Guadalajara, México, diez años. Tengo mi cédula profesional. Vivo en San José. Mandé la solicitud a la CTC y me regresaron una carta que no entiendo." })).text());
  expect(es.join("\n")).toContain("Empieza aquí");
});

test("a request through a tunnel without a token is refused", async ({ request }) => {
  const r = await post(request, { From: "whatsapp:+15550001111", NumMedia: "0", Body: "Hi" }, { Host: "abc.ngrok-free.app" });
  expect(r.status()).toBe(403);
});
