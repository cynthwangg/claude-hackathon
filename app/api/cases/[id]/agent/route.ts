import { agentTurn } from "@/lib/agent";
import { loadCase } from "@/lib/case";
import { fail, handle, ok, type Ctx } from "@/lib/http";
import type { Topic } from "@/lib/model/types";

const PICKS = ["menu", "case", "roles", "visa", "resume"];

/** The web side of the shared agent. Same thread as WhatsApp. Body is { text } or { pick }. */
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; pick?: unknown };
    const text = typeof body.text === "string" && body.text.trim() ? body.text.trim().slice(0, 4000) : null;
    const pick = typeof body.pick === "string" && PICKS.includes(body.pick) ? (body.pick as Topic | "menu") : null;
    if (!text && !pick) return fail("bad_value", 400);
    const reply = await agentTurn(id, { text, pick }, "web");
    const c = await loadCase(id);
    return ok({ reply, history: c?.history ?? [], topic: c?.topic ?? null });
  });
}
