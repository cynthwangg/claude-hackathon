import { confirmDocument } from "@/lib/case";
import { handle, ok, type Ctx } from "@/lib/http";

export async function POST(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    await confirmDocument(id);
    return ok({ ok: true });
  });
}
