import { correctFact } from "@/lib/case";
import { handle, ok, type Ctx } from "@/lib/http";

export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json()) as { value: unknown };
    const v = typeof body.value === "string" ? body.value.slice(0, 500) : body.value;
    const f = await correctFact(id, v);
    return ok({ fact: { id: f.id, value: JSON.parse(f.value) } });
  });
}
