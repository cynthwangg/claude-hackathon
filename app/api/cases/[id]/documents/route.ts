import { ACCEPTED_MIME, documentView, ingestDocument, loadCase } from "@/lib/case";
import { fail, handle, ok, type Ctx } from "@/lib/http";
import { requestOrder } from "@/lib/intake/router";

export const maxDuration = 120;

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const c = await loadCase(id);
    if (!c) return fail("not_found", 404);
    const docs = await Promise.all(c.documents.map((d) => documentView(d.id)));
    return ok({ documents: docs.filter(Boolean), order: requestOrder(c.intakeObj, c.routing.kind), country: c.intakeObj.country_of_training, route_kind: c.routing.kind });
  });
}

export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const hint = form.get("kind_hint");
    if (!(file instanceof File)) return fail("no_file", 400);
    const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    if (!ACCEPTED_MIME.includes(mime)) return fail("unsupported_type", 400);
    if (file.size > 20 * 1024 * 1024) return fail("too_large", 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const kindHint = typeof hint === "string" && hint ? hint : null;
    const doc = await ingestDocument(id, { bytes, mime, name: file.name }, kindHint);
    return ok({ document: doc, reclassified: !!(doc && kindHint && doc.status === "read" && doc.kind !== kindHint) });
  });
}
