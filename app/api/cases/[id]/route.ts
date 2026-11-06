import { loadCase } from "@/lib/case";
import { fail, handle, ok, type Ctx } from "@/lib/http";
import { missingRequired } from "@/lib/intake/types";
import { caseHeader } from "@/lib/views";

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const c = await loadCase(id);
    if (!c) return fail("not_found", 404);
    const missing = missingRequired(c.intakeObj);
    return ok({ header: await caseHeader(c), intake: c.intakeObj, history: c.history, topic: c.topic, missing, done: missing.length === 0 });
  });
}
