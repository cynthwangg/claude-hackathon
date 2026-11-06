import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Screenshots of every screen at 390 and 1280 for the design critic. English is the demo language. */
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "/tmp/earned-shots";
const fx = (d: string, f: string) => ({ name: f, mimeType: f.endsWith(".pdf") ? "application/pdf" : "image/jpeg", buffer: fs.readFileSync(path.join(process.cwd(), "fixtures", d, f)) });

async function seed(page: Page, lang: string, opener: string, dir: string, files: string[]) {
  const { case_id } = await (await page.request.post(`${BASE}/api/cases`, { data: { language: lang } })).json();
  await page.request.post(`${BASE}/api/cases/${case_id}/messages`, { data: { text: opener } });
  for (const f of files) if (!(await page.request.post(`${BASE}/api/cases/${case_id}/documents`, { multipart: { file: fx(dir, f) } })).ok()) throw new Error(f);
  await page.request.post(`${BASE}/api/cases/${case_id}/position`);
  return case_id as string;
}
const MARIANA = ["06-ctc-letter-returned.pdf", "05-evaluation-report-general.pdf", "01-certificado-estudios.jpg", "02-titulo.pdf", "03-cedula-profesional.jpg", "04-constancia-servicio.pdf"];
const EN = "Hi, I'm Mariana. I taught primary school, second to fifth grade, in Guadalajara, Mexico for ten years. I have my cédula profesional. I live in San Jose now. I applied to the CTC and they sent back a letter I don't really understand.";
const ES = "Hola, soy Mariana. Fui maestra de primaria, de segundo a quinto, en Guadalajara, México, diez años. Tengo mi cédula profesional. Ahora vivo en San José. Mandé la solicitud a la CTC y me regresaron una carta que no entiendo bien.";
const ZH = "你好，我叫林薇。我在中国杭州教了八年初中语文。我现在住在奥克兰。我有毕业证和教师资格证。我正准备付钱给一家机构做学历评估，但不知道从哪里开始。";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [vw, vh, tag] of [[390, 844, "phone"], [1280, 800, "desktop"]] as const) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const shot = async (name: string, full = true) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), fullPage: full }); };

    await page.goto(BASE);
    await shot("01-welcome");
    await page.locator("main .btn").click();
    await page.waitForURL(/\/c\/[a-z0-9]+$/);
    await shot("02-opener-empty");
    await page.getByRole("button", { name: "A primary teacher from Mexico whose application came back" }).click();
    await page.locator("a.btn").waitFor();
    await shot("03-opener-summary");
    await page.locator("a.btn").click();
    await page.locator("section.ask").waitFor();
    await shot("04-documents-first-request");

    const id = await seed(page, "en", EN, "mariana", MARIANA);
    const go = async (route: string) => { await page.goto(`${BASE}/c/${id}/${route}`); await page.locator("h1").first().waitFor(); };
    await go("documents");
    await shot("05-documents-read");
    await go("position");
    await shot("06-position");
    await page.locator(".item", { hasText: "That the evaluation mentions" }).getByRole("button").first().click();
    await page.getByRole("dialog").locator("h2").waitFor();
    await shot("07-why-drawer", false);
    await page.keyboard.press("Escape");
    for (const [route, name] of [["route", "08-route"], ["week", "09-week"], ["letter/request_school_letter", "10-letter-school"], ["letter/request_evaluation", "11-letter-agency"], ["progress", "12-progress"]] as const) {
      await go(route);
      await shot(name);
    }
    await go("change");
    await page.getByLabel("My school can send a letter about my practicum").selectOption("no");
    await page.getByRole("button", { name: "Show what changes" }).click();
    await page.getByRole("heading", { name: "What changes" }).waitFor();
    await shot("13-change-result");

    const es = await seed(page, "es", ES, "mariana", MARIANA);
    await page.goto(`${BASE}/c/${es}/position`);
    await page.locator("h1").waitFor();
    await shot("14-position-es");
    const zh = await seed(page, "zh", ZH, "linwei", ["01-chengjidan.jpg", "02-biyezheng-xueweizheng.jpg", "03-jiaoshi-zigezheng.jpg", "04-gongzuo-zhengming.jpg"]);
    await page.goto(`${BASE}/c/${zh}/position`);
    await page.locator("h1").waitFor();
    await shot("15-position-zh");
    await ctx.close();
  }
  await browser.close();
  console.log(fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length, "screenshots in", OUT);
})();
