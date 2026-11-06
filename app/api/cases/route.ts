import { createCase } from "@/lib/case";
import { handle, ok } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { language?: string };
    const c = await createCase(body.language ?? "en");
    return ok({ case_id: c.id });
  });
}
