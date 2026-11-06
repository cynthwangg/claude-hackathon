import { setStated } from "@/lib/case";
import { handle, ok, type Ctx } from "@/lib/http";

export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json()) as { key: string; value: unknown };
    await setStated(id, body.key, body.value);
    return ok({ ok: true });
  });
}
