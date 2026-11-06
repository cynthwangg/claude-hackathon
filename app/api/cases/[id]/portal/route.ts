import { handle, ok, type Ctx } from "@/lib/http";
import { portalView } from "@/lib/portal";

/** The case portal. Evaluates on every load, like the position screen, so nothing shown is stale. */
export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => ok(await portalView((await params).id)));
}
