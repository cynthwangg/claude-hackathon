import { expect, test } from "@playwright/test";
import path from "node:path";
import zh from "../../locales/zh.json";
import en from "../../locales/en.json";

type Dict = Record<string, string>;
const tt = (k: string, v: Record<string, string> = {}) => (((zh as Dict)[k] ?? (en as Dict)[k]) as string).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
const F = (f: string) => path.join(process.cwd(), "fixtures", "linwei", f);

test("Lin Wei in Mandarin on the partial route (D23, D24)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "中文" }).click();
  await page.getByRole("button", { name: tt("welcome.start") }).click();
  await page.waitForURL(/\/c\/[a-z0-9]+$/);
  await page.getByRole("button", { name: tt("opener.ex_lin") }).click();
  await expect(page.getByText(tt("opener.understood"))).toBeVisible();
  await expect(page.locator("main")).toContainText("CL-870");
  await page.getByRole("link", { name: tt("opener.continue") }).click();

  const steps: [string, string][] = [["01-chengjidan.jpg", "noun.transcript"], ["02-biyezheng-xueweizheng.jpg", "noun.degree"], ["03-jiaoshi-zigezheng.jpg", "noun.license"], ["04-gongzuo-zhengming.jpg", "noun.experience"]];
  for (const [i, [file, noun]] of steps.entries()) {
    await expect(page.getByRole("heading", { name: tt(i === 0 ? "docs.first" : "docs.next", { noun: tt(noun) }) })).toBeVisible();
    await page.locator("section.ask input[type=file]").setInputFiles(F(file));
    await expect(page.getByText(tt("docs.header", { noun: tt(noun) })).first()).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.locator(".mark", { hasText: "教育实习" }).first()).toBeVisible();
  await page.getByRole("link", { name: tt("docs.continue") }).click();

  await expect(page.getByRole("heading", { name: tt("position.header", { name: "林薇" }) })).toBeVisible();
  const main = page.locator("main");
  await expect(main).toContainText(tt("position.near_note"));
  await expect(main).toContainText("教育实习");
  await expect(main).not.toContainText("Preparation for elementary teaching");
  await expect(main).not.toContainText("Cédula");

  await page.getByRole("link", { name: tt("nav.week") }).first().click();
  await expect(page.getByRole("heading", { name: tt("week.request_evaluation") })).toBeVisible();
  await expect(main).toContainText("course-by-course");
  await expect(main).not.toContainText(/\$\d/);
});
