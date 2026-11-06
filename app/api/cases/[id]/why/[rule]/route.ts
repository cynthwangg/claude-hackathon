import { analysisOf, loadCase } from "@/lib/case";
import { fail, handle, ok, type Ctx } from "@/lib/http";
import { rules } from "@/rules/ctc-ms-foreign";
import { whyView } from "@/lib/views";

export async function GET(_: Request, { params }: Ctx<{ id: string; rule: string }>) {
  return handle(async () => {
    const { id, rule } = await params;
    if (!rules.some((r) => r.id === rule)) return fail("not_found", 404);
    const c = await loadCase(id);
    if (!c) return fail("not_found", 404);
    return ok(whyView(c.lang, rule, analysisOf(c), c.documents.map((d) => ({ id: d.id, kind: d.kind }))));
  });
}
