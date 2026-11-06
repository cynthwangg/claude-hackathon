import { analysisOf, loadCase } from "./case";
import { db } from "./db";
import type { ActionKind } from "./engine/plan";
import { guardModelText } from "./guard";
import { draftFor, type Draft } from "./letters";
import { provider } from "./model";
import { findOffice } from "./office";

export type DraftView = Draft & { aid: string | null; aid_label: "letter.aid_same" | "letter.aid_other" | null };

/** The letter is filled by code. The model only translates it so she can read what she is sending (F8). */
export async function draftForCase(caseId: string, kind: ActionKind | "office_question", actionId: string | null): Promise<DraftView | null> {
  const c = await loadCase(caseId);
  if (!c) throw new Error("case_not_found");
  const a = analysisOf(c);
  const office = kind === "office_question" ? await findOffice(c.intakeObj.profession, c.intakeObj.profession_words, c.intakeObj.us_state) : null;
  const d = draftFor(kind, a.facts, { name: c.intakeObj.first_name, country: c.intakeObj.country_of_training, profession: c.intakeObj.profession, state: c.intakeObj.us_state, office: office ? `${office.name}, ${office.url}` : null });
  if (!d) return null;
  let aid: string | null = null;
  if (d.language !== c.lang) {
    try {
      aid = guardModelText(await provider().translateLetter(c.lang, d.body));
    } catch {
      aid = null;
    }
  }
  if (actionId) await db.action.update({ where: { id: actionId }, data: { draft_primary: d.body, draft_aid: aid, draft_lang: d.language } });
  return { ...d, aid, aid_label: aid ? "letter.aid_same" : null };
}
