import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { ELIGIBILITY_CLAIM } from "@/lib/guard";
import { routeIntake } from "@/lib/intake/router";
import { emptyIntake, mergeIntake, missingRequired } from "@/lib/intake/types";

for (const line of fs.existsSync(".env") ? fs.readFileSync(".env", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.MODEL_PROVIDER = "anthropic";
const live = process.env.LIVE === "1" ? describe : describe.skip;

live("live intake with Claude", () => {
  const turn = async (lang: "es" | "en" | "zh", text: string) => {
    const { anthropicProvider } = await import("@/lib/model/anthropic");
    const i = emptyIntake();
    const r = await anthropicProvider.intakeTurn(lang, [{ role: "user", text }], i, missingRequired(i));
    return { say: r.say, intake: mergeIntake(i, r.intake) };
  };

  it("one Spanish message fills everything the router needs", async () => {
    const r = await turn("es", "Hola, soy Mariana. Fui maestra de primaria, de segundo a quinto, en Guadalajara, México, diez años. Tengo mi cédula profesional. Ahora vivo en San José. Mandé la solicitud a la CTC y me regresaron una carta que no entiendo bien.");
    expect(r.intake).toMatchObject({ first_name: "Mariana", profession: "teacher", country_of_training: "Mexico", us_state: "CA", has_foreign_license: true, stage: "applied_letter_received" });
    expect(missingRequired(r.intake)).toEqual([]);
    expect(routeIntake(r.intake).kind).toBe("match");
  });

  it("a Mandarin junior high teacher routes to the near pathway", async () => {
    const r = await turn("zh", "你好，我叫林薇。我在中国杭州教了八年初中语文。我现在住在奥克兰。我有毕业证和教师资格证。我正准备付钱给一家机构做学历评估，但不知道从哪里开始。");
    expect(r.intake).toMatchObject({ first_name: "林薇", profession: "teacher", level: "secondary", country_of_training: "China", stage: "about_to_pay_agency" });
    // Oakland alone may not be taken as California (D21). Then the next turn must ask for the state.
    if (r.intake.us_state === null) expect(r.say).toMatch(/州/);
    else expect(routeIntake(r.intake).kind).toBe("near");
    expect(routeIntake({ ...r.intake, us_state: "CA" }).kind).toBe("near");
  });

  it("asks one question for what is missing and makes no eligibility claim", async () => {
    const r = await turn("en", "I was a nurse in Manila for six years. Do I qualify to work here?");
    expect(r.intake.profession).toBe("nurse");
    expect(r.intake.us_state).toBeNull();
    expect(r.say.length).toBeGreaterThan(10);
    expect(ELIGIBILITY_CLAIM.test(r.say)).toBe(false);
  });

  it("finds an official office for a profession and state not in the table, or none", async () => {
    const { findOffice, isOfficialHost } = await import("@/lib/office");
    const o = await findOffice("social_worker", "social worker", "IL");
    if (o) expect(isOfficialHost(o.url)).toBe(true);
    console.log("office found:", o?.name, o?.url);
  });
});
