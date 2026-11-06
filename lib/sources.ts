import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "\u2013", "&mdash;": "\u2014" };

/** Strips a page to text. Removes script, style, nav, header and footer, unescapes entities, collapses whitespace. */
export function strip(html: string): string {
  return html
    .replace(/<(script|style|nav|header|footer|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(a|em|strong|b|i|u|span|sup|sub|abbr|small|mark)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compares on words only, so quotes taken from table cells or with curly quotes still match, in order. */
export const normalizeQuote = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}$'.-]+/gu, " ").replace(/(\w)[.](\s|$)/g, "$1$2").replace(/\s+/g, " ").trim();

/** An excerpt with "..." is checked part by part, because the rule quotes two passages of one page. */
export function excerptFound(pageText: string, excerpt: string) {
  const page = ` ${normalizeQuote(pageText)} `;
  return excerpt.split(/\s*\.\.\.\s*/).map(normalizeQuote).filter((p) => p.length > 12).every((part) => page.includes(` ${part} `) || page.includes(part));
}

const BLOCK_PAGE = /attention required|sorry, you have been blocked|enable cookies|cf-ray|just a moment/i;

type Result = { result: "found" | "not_found" | "fetch_failed"; checked_at: string };
const results = new Map<string, Result>();
const pages = new Map<string, { text: string; at: number }>();
const HOUR = 3600_000;

async function pageText(url: string): Promise<string | null> {
  const hit = pages.get(url);
  if (hit && Date.now() - hit.at < HOUR) return hit.text;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Bridge source check)" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  let text: string;
  if (type.includes("pdf")) {
    const tmp = path.join(os.tmpdir(), `earned-src-${Date.now()}.pdf`);
    await fs.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
    try {
      text = (await run("pdftotext", ["-layout", tmp, "-"], { maxBuffer: 20 * 1024 * 1024 })).stdout.replace(/\s+/g, " ");
    } catch {
      return null;
    } finally {
      await fs.rm(tmp, { force: true });
    }
  } else if (type.includes("html")) {
    const html = await res.text();
    if (BLOCK_PAGE.test(html.slice(0, 4000)) && html.length < 20_000) return null;
    text = strip(html);
  } else return null;
  pages.set(url, { text, at: Date.now() });
  return text;
}

/** V2.2. Never changes a rule or a state; a page that cannot be read is fetch_failed, never not_found. */
export async function liveCheck(ruleId: string, url: string, excerpt: string): Promise<Result> {
  const prev = results.get(ruleId);
  if (prev && prev.result === "found" && Date.now() - Date.parse(prev.checked_at) < HOUR) return prev;
  const checked_at = new Date().toISOString();
  try {
    const text = await pageText(url);
    if (text === null) return prev ?? { result: "fetch_failed", checked_at };
    const out: Result = { result: excerptFound(text, excerpt) ? "found" : "not_found", checked_at };
    results.set(ruleId, out);
    return out;
  } catch {
    return prev ?? { result: "fetch_failed", checked_at };
  }
}
