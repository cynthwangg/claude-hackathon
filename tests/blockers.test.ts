import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import zh from "@/locales/zh.json";
import { analyze } from "@/lib/engine/analyze";
import { ELIGIBILITY_CLAIM, FORBIDDEN_IN_UNKNOWN } from "@/lib/guard";
import { whyView } from "@/lib/views";
import { rules } from "@/rules/ctc-ms-foreign";
import { TODAY, golden, marianaRows, marianaStated } from "./helpers";

/** Section 19. Any failure here means do not show it. */
function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.(ts|tsx|json|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const SOURCE = ["locales", "app", "components", "lib"].flatMap((d) => files(path.join(process.cwd(), d)));
const UI = ["locales", "app", "components"].flatMap((d) => files(path.join(process.cwd(), d)));
const STRINGS = [en, es, zh].flatMap((d) => Object.entries(d as Record<string, string>));

describe("release blockers", () => {
  it("no em dash in locales, app, components or lib", () => {
    for (const f of SOURCE) expect([f, fs.readFileSync(f, "utf8").includes("\u2014")]).toEqual([f, false]);
  });

  it("no dollar amount other than $100, $2.65 and $49", () => {
    for (const f of UI) {
      const amounts = fs.readFileSync(f, "utf8").match(/\$\d[\d,.]*/g) ?? [];
      for (const a of amounts) expect([f, ["$100", "$2.65", "$49"].includes(a.replace(/[.,]$/, ""))]).toEqual([f, true]);
    }
  });

  it("no copy claims eligibility about her", () => {
    for (const [k, v] of STRINGS) expect([k, ELIGIBILITY_CLAIM.test(v)]).toEqual([k, false]);
    for (const f of UI) expect([f, ELIGIBILITY_CLAIM.test(fs.readFileSync(f, "utf8"))]).toEqual([f, false]);
  });

  it("no percentage, exclamation mark or running-text colon in UI strings", () => {
    for (const [k, v] of STRINGS) {
      expect([k, /\d\s?%|%\s?\d/.test(v)]).toEqual([k, false]);
      expect([k, /[!！]/.test(v)]).toEqual([k, false]);
      expect([k, /[:：](?!\/\/)/.test(v)]).toEqual([k, false]);
    }
  });

  it("abstention copy never guesses", () => {
    for (const [k, v] of STRINGS) if (k.includes(".unknown.")) expect([k, FORBIDDEN_IN_UNKNOWN.test(v)]).toEqual([k, false]);
  });

  it("no requirement reaches checked or official without a checked fact or a decision document", () => {
    for (const rows of [marianaRows(), golden("edge/evaluation-unknown-agency"), golden("edge/transcript-no-practicum")]) {
      for (const r of analyze(rows, marianaStated, TODAY).requirements) expect([r.rule_id, ["checked", "official"].includes(r.state)]).toEqual([r.rule_id, false]);
    }
  });

  it("every Why drawer quote equals the rule excerpt byte for byte", () => {
    for (const r of rules) expect(whyView("es", r.id, null, []).excerpt).toBe(r.excerpt);
  });
});
