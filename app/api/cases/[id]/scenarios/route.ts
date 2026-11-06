import { loadCase } from "@/lib/case";
import { fail, handle, ok, type Ctx } from "@/lib/http";
import { cleanPatch, runScenario } from "@/lib/scenario";

export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const c = await loadCase(id);
    if (!c) return fail("not_found", 404);
    const body = (await req.json()) as { patch?: Record<string, unknown> };
    return ok(await runScenario(c, cleanPatch(body.patch ?? {})));
  });
}
