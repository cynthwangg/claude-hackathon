import { analysisOf, loadCase } from "@/lib/case";
import { fmtDate, t } from "@/lib/i18n";
import { fail, handle, ok, type Ctx } from "@/lib/http";

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const c = await loadCase(id);
    if (!c) return fail("not_found", 404);
    const a = analysisOf(c);
    const lang = c.lang;
    const actions = c.actions.map((x) => {
      const history = JSON.parse(x.history) as { state: string; at: string; source?: string }[];
      const last = history[history.length - 1];
      const ids = JSON.parse(x.rule_ids) as string[];
      const official = x.state === "accepted" && ids.some((r) => a.facts.officialDecisionFor(r));
      const word = x.state === "accepted" && !official ? t(lang, "progress.state.accepted_statement") : t(lang, `progress.state.${x.state}`);
      return {
        id: x.id, kind: x.kind, title: t(lang, `action.${x.kind}`), state: x.state, state_word: word, statement_only: x.state === "accepted" && !official,
        since: last ? t(lang, "progress.since", { date: fmtDate(lang, last.at.slice(0, 10)) }) : null,
        deadline: x.deadline ? t(lang, "progress.deadline", { date: fmtDate(lang, x.deadline.toISOString().slice(0, 10)) }) : null,
        can_undo: history.length > 1,
      };
    });
    const letters = c.documents.filter((d) => d.kind === "ctc_letter" && d.status === "read").map((d) => d.id);
    return ok({ actions, ctc_letter_documents: letters });
  });
}
