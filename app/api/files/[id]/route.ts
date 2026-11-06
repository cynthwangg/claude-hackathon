import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { UPLOADS } from "@/lib/case";
import { fail, handle, type Ctx } from "@/lib/http";

export async function GET(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const d = await db.document.findUnique({ where: { id } });
    if (!d || !d.file_path) return fail("not_found", 404);
    const preview = new URL(req.url).searchParams.get("preview") === "1";
    const p = preview ? path.join(UPLOADS, d.case_id, `${d.id}-preview.jpg`) : d.file_path;
    if (!p.startsWith(UPLOADS)) return fail("not_found", 404);
    const bytes = await fs.readFile(p).catch(() => null);
    if (!bytes) return fail("not_found", 404);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": preview ? "image/jpeg" : d.mime ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
  });
}
