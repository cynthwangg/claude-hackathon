import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Screenshots of every screen at 390 and 1280 for the design critic. Usage: tsx scripts/shots.ts <baseUrl> <outDir> */
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "/tmp/earned-shots";
const F = (d: string, f: string) => path.join(process.cwd(), "fixtures", d, f);

async function seed(page: Page, lang: "es" | "en") {
  await page.goto(BASE);
  await page.getByRole("button", { name: lang === "es" ? "Español" : "English" }).click();
  await page.locator("main .btn").click();
  await page.waitForURL(/\/c\/[a-z0-9]+$/);
  const id = page.url().split("/c/")[1];
  await page.getByRole("button", { name: lang === "es" ? "Una maestra de primaria de México con una carta de la CTC" : "A primary teacher from Mexico with a letter from the CTC" }).click();
  await page.locator("a.btn").waitFor();
  for (const f of ["06-ctc-letter-returned.pdf", "05-evaluation-report-general.pdf", "01-certificado-estudios.jpg", "02-titulo.pdf", "03-cedula-profesional.jpg", "04-constancia-servicio.pdf"]) {
    const res = await page.request.post(`${BASE}/api/cases/${id}/documents`, { multipart: { file: { name: f, mimeType: f.endsWith(".pdf") ? "application/pdf" : "image/jpeg", buffer: fs.readFileSync(F("mariana", f)) } } });
    if (!res.ok()) throw new Error(`upload ${f} ${res.status()}`);
  }
  return id;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [vw, vh, tag] of [[390, 844, "phone"], [1280, 800, "desktop"]] as const) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const shot = async (name: string) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), fullPage: true });

    await page.goto(BASE);
    await page.getByRole("button", { name: "Español" }).click();
    await shot("01-welcome");
    await page.locator("main .btn").click();
    await page.waitForURL(/\/c\/[a-z0-9]+$/);
    await shot("02-opener-empty");
    await page.getByRole("button", { name: "Una maestra de primaria de México con una carta de la CTC" }).click();
    await page.locator("a.btn").waitFor();
    await shot("03-opener-summary");
    const first = page.url().split("/c/")[1];
    await page.goto(`${BASE}/c/${first}/documents`);
    await page.getByRole("heading", { level: 2 }).first().waitFor();
    await shot("04-documents-first-request");

    const id = await seed(page, "es");
    await page.request.post(`${BASE}/api/cases/${id}/position`);
    await page.goto(`${BASE}/c/${id}/documents`);
    await page.locator(".docgrid").first().waitFor();
    await shot("05-documents-read");
    await page.goto(`${BASE}/c/${id}/position`);
    await page.locator("h1").waitFor();
    await shot("06-position");
    await page.locator(".item", { hasText: "Que la evaluación mencione" }).getByRole("button").click();
    await page.getByRole("dialog").locator("h2").waitFor();
    await page.screenshot({ path: path.join(OUT, `${tag}-07-why-drawer.png`) });
    await page.keyboard.press("Escape");
    for (const [route, name] of [["route", "08-route"], ["week", "09-week"], ["letter/request_school_letter", "10-letter-school"], ["letter/request_evaluation", "11-letter-agency"], ["progress", "12-progress"]] as const) {
      await page.goto(`${BASE}/c/${id}/${route}`);
      await page.locator("h1").waitFor();
      await page.waitForTimeout(300);
      await shot(name);
    }
    await page.goto(`${BASE}/c/${id}/change`);
    await page.locator("select").first().waitFor();
    await page.getByLabel("Mi escuela puede mandar una carta sobre mi práctica").selectOption("no");
    await page.getByRole("button", { name: "Ver qué cambia" }).click();
    await page.getByRole("heading", { name: "Lo que cambia" }).waitFor();
    await shot("13-change-result");
    const en = await seed(page, "en");
    await page.goto(`${BASE}/c/${en}/position`);
    await page.locator("h1").waitFor();
    await shot("14-position-en");
    await ctx.close();
  }
  await browser.close();
  console.log(fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length, "screenshots in", OUT);
})();
