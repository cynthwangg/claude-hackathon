import { fail, handle, ok, type Ctx } from "@/lib/http";
import { liveCheck } from "@/lib/sources";
import { rules } from "@/rules/ctc-ms-foreign";

/** V2.2. Confirms the quoted sentence is still on the CTC page. Never changes a rule or a state. */
export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const r = rules.find((x) => x.id === id);
    if (!r) return fail("not_found", 404);
    return ok(await liveCheck(r.id, r.source_url, r.excerpt));
  });
}
