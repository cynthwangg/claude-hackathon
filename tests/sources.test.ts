import { describe, expect, it } from "vitest";
import { excerptFound, strip } from "@/lib/sources";
import { ruleById } from "@/rules/ctc-ms-foreign";

const page = (body: string) => `<html><head><script>var x=1</script></head><body><nav>Menu</nav><p>${body}</p><footer>f</footer></body></html>`;

describe("live source check", () => {
  it("finds the CL-635 sentence across tags and entities", () => {
    const r = ruleById("R01");
    const html = page(r.excerpt.replace("course-by-course", "course-by-<em>course</em>").replace(/,/, "&#44;"));
    expect(excerptFound(strip(html), r.excerpt)).toBe(true);
  });
  it("reports not found when the sentence was removed", () => {
    expect(excerptFound(strip(page("Some other text about evaluations.")), ruleById("R01").excerpt)).toBe(false);
  });
  it("checks both parts of an excerpt joined with an ellipsis", () => {
    const r = ruleById("R17");
    const [a, b] = r.excerpt.split(" ... ");
    expect(excerptFound(strip(page(`${a} in total. ${b}`)), r.excerpt)).toBe(true);
    expect(excerptFound(strip(page(a)), r.excerpt)).toBe(false);
  });
});

describe("live source check, robustness", () => {
  it("matches a quote taken across table cells", () => {
    const r = ruleById("R09");
    const html = `<table><tr><td>Applicants Residing in California</td></tr><tr><td>Live Scan Service (Form 41-LS)</td><td>Fee Collected by Live Scan Operator</td></tr><tr><td>Applicants Residing Outside of California</td></tr><tr><td>Fingerprint Cards (FD-258)</td><td>$49.00</td></tr></table>`;
    expect(excerptFound(strip(html), r.excerpt)).toBe(true);
  });
  it("does not match words out of order", () => {
    expect(excerptFound("Live Scan Operator Fee Collected by", "Fee Collected by Live Scan Operator and more words")).toBe(false);
  });
});
