import { describe, expect, it } from "vitest";
import { parseIntake } from "@/lib/model/mock";
import { routeIntake, requestOrder } from "@/lib/intake/router";
import { emptyIntake, mergeIntake, missingRequired } from "@/lib/intake/types";

const intakeOf = (s: string) => mergeIntake(emptyIntake(), parseIntake(s));

describe("intake router", () => {
  it("routes Mariana to the deep elementary pathway with the letter requested first", () => {
    const i = intakeOf("Hi, I'm Mariana. I taught primary school in Guadalajara, Mexico for ten years. I have my cédula profesional. I live in San Jose now. I applied to the CTC and they sent back a letter I don't understand.");
    expect(missingRequired(i)).toEqual([]);
    expect(routeIntake(i).kind).toBe("match");
    expect(requestOrder(i, "match")[0]).toBe("ctc_letter");
    expect(i.first_name).toBe("Mariana");
    expect(i.years_experience).toBe(10);
  });
  it("routes a junior high teacher in Oakland to the near pathway", () => {
    const i = intakeOf("你好，我叫林薇。我在中国杭州教了八年初中语文。我现在住在奥克兰。我有毕业证和教师资格证。我正准备付钱给一家机构做学历评估。");
    expect(i.first_name).toBe("林薇");
    expect(i.years_experience).toBe(8);
    expect(routeIntake(mergeIntake(i, { us_state: "CA" })).kind).toBe("near");
  });
  it("a certificate does not put a Brooklyn teacher in California (F13)", () => {
    const i = intakeOf("I taught in Mexico and have my teacher certificate. I live in Brooklyn.");
    expect(i.us_state).toBe("NY");
    expect(routeIntake(i).kind).toBe("none");
  });
  it("a missing state is never defaulted", () => {
    const i = intakeOf("I taught primary school in Mexico for ten years.");
    expect(i.us_state).toBeNull();
    expect(routeIntake(i).reason).toBe("unknown_state");
  });
  it("being told to pay for an evaluation is not holding one (F14)", () => {
    const i = intakeOf("Someone told me to pay for an evaluation.");
    expect(i.holds).not.toContain("evaluation_report");
  });
});
