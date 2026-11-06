import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import en from "../../locales/en.json";
import es from "../../locales/es.json";

const F = (f: string) => path.join(process.cwd(), "fixtures", "mariana", f);
type Dict = Record<string, string>;
const tt = (d: Dict, k: string, v: Record<string, string> = {}) => ((d[k] ?? (en as Dict)[k]) as string).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");

async function upload(page: Page, d: Dict, file: string, noun: string, first = false) {
  await expect(page.getByRole("heading", { name: tt(d, first ? "docs.first" : "docs.next", { noun }) })).toBeVisible();
  await page.locator("section.ask input[type=file]").setInputFiles(F(file));
  await expect(page.getByText(tt(d, "docs.header", { noun })).first()).toBeVisible({ timeout: 30_000 });
}

for (const [lang, d, langLabel] of [["es", es as Dict, "Español"], ["en", en as Dict, "English"]] as const) {
  test(`section 7.1, Mariana after the mistake (${lang})`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: langLabel }).click();
    await page.getByRole("button", { name: tt(d, "welcome.start") }).click();
    await page.waitForURL(/\/c\/[a-z0-9]+$/);

    // 6.2 open opener
    await page.getByRole("button", { name: tt(d, "opener.ex_mariana") }).click();
    await expect(page.getByText(tt(d, "opener.understood"))).toBeVisible();
    await expect(page.getByText("Commission on Teacher Credentialing (CTC)")).toBeVisible();
    await page.getByRole("link", { name: tt(d, "opener.continue") }).click();

    // 6.3 documents one at a time, letter first
    await upload(page, d, "06-ctc-letter-returned.pdf", tt(d, "noun.ctc_letter"), true);
    await upload(page, d, "05-evaluation-report-general.pdf", tt(d, "noun.evaluation_report"));
    await upload(page, d, "01-certificado-estudios.jpg", tt(d, "noun.transcript"));
    await expect(page.locator(".mark", { hasText: "Trabajo Docente II" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(tt(d, "docs.hydrated"))).toBeVisible();
    await page.getByRole("link", { name: tt(d, "docs.continue") }).click();

    // 6.4 position, the practicum is paperwork
    await expect(page.getByRole("heading", { name: tt(d, "position.header", { name: "Mariana" }) })).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).toContain(lang === "es" ? "Tu certificado sí registra Trabajo Docente I y Trabajo Docente II" : "Your transcript does list Trabajo Docente I and Trabajo Docente II");
    expect(body).not.toMatch(/%|—/);
    const sections = await page.locator("main h2").allInnerTexts();
    expect(sections.indexOf(tt(d, "position.have"))).toBeLessThan(sections.indexOf(tt(d, "position.needed")));

    // 6.10 Why drawer for the practicum
    await page.locator(".item", { hasText: lang === "es" ? "Que la evaluación mencione" : "That the evaluation mentions" }).getByRole("button").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("including student teaching");
    await expect(dialog).toContainText("CL-871");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // 6.6 this week
    await page.getByRole("link", { name: tt(d, "nav.week") }).first().click();
    await expect(page.getByRole("heading", { name: tt(d, "week.request_evaluation") })).toBeVisible();
    await expect(page.locator("main")).toContainText("38");
    await expect(page.locator("main .btn")).toHaveCount(1);

    // 6.7 the letter to the school names her courses
    await page.locator(".item", { hasText: tt(d, "week.request_school_letter") }).getByRole("link").click();
    await expect(page.locator("textarea#letter")).toHaveValue(/Trabajo Docente I y Trabajo Docente II/);
    await expect(page.getByText(tt(d, "letter.nothing_sent"))).toBeVisible();

    // 6.8 progress, the school sent it: document obtained, never accepted
    await page.getByRole("link", { name: tt(d, "nav.progress") }).click();
    const school = page.locator(".item", { hasText: tt(d, "action.request_school_letter") });
    await school.getByRole("button", { name: tt(d, "progress.to.sent") }).click();
    await school.getByRole("button", { name: tt(d, "progress.to.document_obtained") }).click();
    await expect(school).toContainText(tt(d, "progress.state.document_obtained"));
    await expect(page.locator("main")).not.toContainText(tt(d, "progress.state.accepted"));

    // 6.9 change my circumstances
    await page.getByRole("link", { name: tt(d, "nav.change") }).click();
    await page.getByLabel(tt(d, "change.school")).selectOption("no");
    await page.getByRole("button", { name: tt(d, "change.show") }).click();
    await expect(page.locator("main")).toContainText(tt(d, "action.ask_ctc_question"));
    await page.getByLabel(tt(d, "change.school")).selectOption("as_is");
    await page.getByLabel(tt(d, "change.city")).selectOption("Los Angeles");
    await page.getByRole("button", { name: tt(d, "change.show") }).click();
    await expect(page.locator("main")).toContainText(tt(d, "change.summary.none"));
  });
}
