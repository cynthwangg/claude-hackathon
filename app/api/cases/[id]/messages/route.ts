import { intakeMessage, loadCase } from "@/lib/case";
import { handle, ok, type Ctx } from "@/lib/http";
import { caseHeader } from "@/lib/views";

export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { text?: string | null };
    const text = typeof body.text === "string" && body.text.trim() ? body.text.trim().slice(0, 4000) : null;
    const r = await intakeMessage(id, text);
    const c = await loadCase(id);
    return ok({ ...r, header: r.done && c ? await caseHeader(c) : null });
  });
}
