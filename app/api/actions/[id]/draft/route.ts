import { db } from "@/lib/db";
import { draftForCase } from "@/lib/drafts";
import type { ActionKind } from "@/lib/engine/plan";
import { fail, handle, ok, type Ctx } from "@/lib/http";

export const maxDuration = 60;

export async function POST(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const x = await db.action.findUnique({ where: { id } });
    if (!x) return fail("not_found", 404);
    const d = await draftForCase(x.case_id, x.kind as ActionKind, x.id);
    if (!d) return fail("no_draft", 404);
    return ok(d);
  });
}
