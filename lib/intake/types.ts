import { z } from "zod";

export const PROFESSIONS = [
  "teacher", "early_childhood_educator", "nurse", "physician", "pharmacist", "dentist", "engineer", "architect",
  "social_worker", "psychologist", "accountant", "lawyer", "physical_therapist", "other",
] as const;

export const STAGES = ["not_started", "about_to_pay_agency", "evaluation_in_hand", "applied_letter_received"] as const;
export const HOLDS = ["transcript", "degree", "license", "evaluation_report", "ctc_letter", "experience"] as const;

export const IntakeSchema = z.object({
  first_name: z.string().nullable(),
  language: z.enum(["en", "es", "zh"]).nullable(),
  profession: z.enum(PROFESSIONS).nullable(),
  profession_words: z.string().nullable().describe("How she named her profession, in her own words"),
  level: z.enum(["early_childhood", "elementary", "secondary", "university", "not_applicable"]).nullable(),
  country_of_training: z.string().nullable().describe("Country name in English"),
  years_experience: z.number().nullable(),
  holds: z.array(z.enum(HOLDS)),
  has_foreign_license: z.boolean().nullable(),
  stage: z.enum(STAGES).nullable(),
  us_state: z.string().nullable().describe("Two-letter US state code where she lives now"),
  city: z.string().nullable(),
  worry: z.string().nullable(),
});

export type Intake = z.infer<typeof IntakeSchema>;

export const emptyIntake = (): Intake => ({
  first_name: null, language: null, profession: null, profession_words: null, level: null, country_of_training: null,
  years_experience: null, holds: [], has_foreign_license: null, stage: null, us_state: null, city: null, worry: null,
});

export const REQUIRED: (keyof Intake)[] = ["profession", "country_of_training", "us_state", "has_foreign_license", "stage"];

export const missingRequired = (i: Intake) => REQUIRED.filter((k) => i[k] === null || i[k] === undefined);

/** Merges a model's intake into the stored one. Facts she already gave are never erased by a later turn. */
export function mergeIntake(prev: Intake, next: Partial<Intake>): Intake {
  const out: Intake = { ...prev };
  for (const k of Object.keys(next) as (keyof Intake)[]) {
    const v = next[k];
    if (k === "holds") out.holds = Array.from(new Set([...(prev.holds ?? []), ...((v as Intake["holds"]) ?? [])]));
    else if (v !== null && v !== undefined && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  if (out.us_state) out.us_state = out.us_state.toUpperCase().slice(0, 2);
  return out;
}

export type Turn = { role: "user" | "assistant"; text: string };
