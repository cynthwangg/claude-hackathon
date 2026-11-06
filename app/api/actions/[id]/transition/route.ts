import { transition, undoTransition } from "@/lib/case";
import { handle, ok, type Ctx } from "@/lib/http";

export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json()) as { state?: string; evidence_document_id?: string | null; undo?: boolean };
    const a = body.undo ? await undoTransition(id) : await transition(id, body.state ?? "", body.evidence_document_id ?? null);
    return ok({ action: { id: a.id, state: a.state } });
  });
}
