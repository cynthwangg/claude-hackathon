/** Release blocker D16. Targets claims about her, not the word (R06 quotes the CTC saying "eligible"). */
export const ELIGIBILITY_CLAIM =
  /(eres|serías|you are|you're|you will be|you'd be) (elegible|eligible)|you qualify|calificas|guaranteed|garantizad|will be accepted|será aceptad|你(有资格|符合条件)|保证/i;

export const FORBIDDEN_IN_UNKNOWN = /\b(probably|likely|most applicants|you should be fine|probablemente|seguramente)\b|很可能|大概/i;

export const EM_DASH = /—/;

/** Cleans a sentence the model wrote before it is shown to her. Returns null when it must not be shown. */
export function guardModelText(s: string): string | null {
  if (ELIGIBILITY_CLAIM.test(s)) return null;
  return s.replace(/—|–/g, ",").replace(/!/g, ".").replace(/\s+,/g, ",").trim();
}
