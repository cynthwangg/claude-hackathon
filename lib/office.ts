import Anthropic from "@anthropic-ai/sdk";
import { findAuthority, type Authority } from "@/data/authorities";
import { isMock } from "./model";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const cache = new Map<string, Authority | null>();

/** A host counts as official only if it is a US government domain. Checked in code, not by the model. */
export const isOfficialHost = (url: string) => {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.endsWith(".gov") || /\.(state|k12)\.[a-z]{2}\.us$/.test(h) || /\.[a-z]{2}\.us$/.test(h);
  } catch {
    return false;
  }
};

/**
 * Names the office that licenses a profession in a state. The table first. Otherwise Claude searches the web,
 * and code accepts the answer only if the URL is an official government host that appeared in the search results.
 */
export async function findOffice(profession: string | null, professionWords: string | null, state: string | null): Promise<Authority | null> {
  if (!profession || !state) return null;
  const hit = findAuthority(profession, state);
  if (hit) return hit;
  const key = `${profession}:${professionWords ?? ""}:${state}`;
  if (cache.has(key)) return cache.get(key)!;
  if (isMock() || (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)) return null;

  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const what = professionWords ? `${profession} (she described it as "${professionWords}")` : profession;
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      system:
        "You find the official state government office that licenses a profession for people trained outside the United States. Use only official government websites. Answer with one line of JSON and nothing else, {\"name\": string, \"url\": string, \"quote\": string}, where url is the official page you found and quote is one sentence copied from it that shows this office issues the license. If you cannot find an official page, answer {\"name\": null, \"url\": null, \"quote\": null}.",
      messages: [{ role: "user", content: `Profession ${what}. State ${state}.` }],
    });
    const seen = new Set<string>();
    for (const b of res.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.type === "web_search_result") seen.add(r.url);
    }
    const textOut = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const m = textOut.match(/\{[\s\S]*\}/);
    const j = m ? (JSON.parse(m[0]) as { name: string | null; url: string | null; quote: string | null }) : null;
    const ok = j?.name && j.url && isOfficialHost(j.url) && [...seen].some((u) => new URL(u).hostname === new URL(j.url!).hostname);
    const out: Authority | null = ok ? { id: `search:${key}`, profession, state, name: j!.name!, url: j!.url!, source: "search", cited: j!.quote ?? undefined } : null;
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
