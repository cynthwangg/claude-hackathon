import fs from "node:fs";
import path from "node:path";
import type { FactRow } from "@/lib/facts";
import { parseDay } from "@/lib/clock";

export const TODAY = parseDay("2026-11-05");

export function golden(file: string): FactRow[] {
  const p = path.join(process.cwd(), "fixtures", path.dirname(file), "expected", `${path.basename(file)}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8")) as { facts: { key: string; value: unknown; original_text?: string; page?: number }[] };
  return j.facts.map((f, i) => ({
    id: `${path.basename(file)}:${i}`,
    key: f.key,
    value: f.value,
    original_text: f.original_text ?? null,
    page: f.page ?? null,
    state: "from_document" as const,
    source: "document",
    document_id: path.basename(file),
  }));
}

export const MARIANA = ["mariana/01-certificado-estudios", "mariana/02-titulo", "mariana/03-cedula-profesional", "mariana/04-constancia-servicio", "mariana/05-evaluation-report-general", "mariana/06-ctc-letter-returned"];

export const marianaRows = () => MARIANA.flatMap(golden);

export const marianaStated = { first_name: "Mariana", has_foreign_license: true, stage: "applied_letter_received", lives_in_california: true, city: "San Jose" };

export const fact = (key: string, value: unknown, state: FactRow["state"] = "from_document"): FactRow => ({ id: `t:${key}`, key, value, original_text: null, page: null, state, source: "document", document_id: "t" });
