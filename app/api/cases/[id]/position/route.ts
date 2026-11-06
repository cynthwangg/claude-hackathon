import { evaluateAndSync, loadCase } from "@/lib/case";
import { fail, handle, ok, type Ctx } from "@/lib/http";
import { caseHeader, positionView, routeView, weekView } from "@/lib/views";

/** GET and POST both evaluate: rules run on every load, so the deadline and actions never go stale (D7). */
async function payload(id: string) {
  const exists = await loadCase(id);
  if (!exists) return fail("not_found", 404);
  const a = await evaluateAndSync(id);
  const c = (await loadCase(id))!;
  return ok({ header: await caseHeader(c), position: positionView(c, a), route: routeView(c, a), week: weekView(c, a) });
}

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => payload((await params).id));
}

export async function POST(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => payload((await params).id));
}
