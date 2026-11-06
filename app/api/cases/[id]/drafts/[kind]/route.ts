import { draftForCase } from "@/lib/drafts";
import type { ActionKind } from "@/lib/engine/plan";
import { fail, handle, ok, type Ctx } from "@/lib/http";

const KINDS = ["request_evaluation", "request_school_letter", "ask_ctc_question", "respond_ctc_letter", "confirm_resubmit", "office_question"];

export const maxDuration = 60;

export async function POST(_: Request, { params }: Ctx<{ id: string; kind: string }>) {
  return handle(async () => {
    const { id, kind } = await params;
    if (!KINDS.includes(kind)) return fail("not_found", 404);
    const d = await draftForCase(id, kind as ActionKind | "office_question", null);
    if (!d) return fail("no_draft", 404);
    return ok(d);
  });
}
