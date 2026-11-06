import fs from "node:fs/promises";
import path from "node:path";
import { seed, type Member, type Step } from "./circle";
import { emptyMemory, type Memory } from "./proactive";

/**
 * Community state until the Part III migration (spec section 37) lands. One JSON file under uploads/, which is
 * already ignored and already where case data lives. Real members are cases that said yes; the synthetic members in
 * data/circles.json are added on read so a count exists before anyone has joined. Same shapes the tables will have.
 */
export type StoredMember = Member & { case_id: string; chat_joined: boolean; group_link_sent_at: string | null };
export type ChatMsg = { id: string; circle_id: string; case_id: string | null; first_name: string | null; text: string; at: string };
type Store = {
  members: StoredMember[];
  chat: ChatMsg[];
  memory: Record<string, Memory>;
  /** The last "since you were here" lines, so a reload a minute later shows them again instead of nothing. */
  lead: Record<string, { at: string; lines: string[] }>;
};

const FILE = () => process.env.COMMUNITY_STORE ?? path.join(process.cwd(), "uploads", "community.json");
const empty = (): Store => ({ members: [], chat: [], memory: {}, lead: {} });

let chain: Promise<unknown> = Promise.resolve();

async function read(): Promise<Store> {
  try {
    return { ...empty(), ...(JSON.parse(await fs.readFile(FILE(), "utf8")) as Partial<Store>) };
  } catch {
    return empty();
  }
}

/** Every write goes through one queue, so two requests never interleave a read and a write. */
export function update<T>(fn: (s: Store) => T | Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const s = await read();
    const out = await fn(s);
    await fs.mkdir(path.dirname(FILE()), { recursive: true });
    await fs.writeFile(FILE(), JSON.stringify(s, null, 1));
    return out;
  });
  chain = next.catch(() => undefined);
  return next;
}

export const load = () => chain.then(read, read);

/** Synthetic members first, then real ones. Counting and timing never tell them apart; the UI labels synthetic data. */
export const allMembers = (s: Store): Member[] => [...seed().members, ...s.members];
export const memberOf = (s: Store, caseId: string) => s.members.find((m) => m.case_id === caseId) ?? null;
export const memoryOf = (s: Store, caseId: string) => s.memory[caseId] ?? emptyMemory();

export function upsertMember(s: Store, m: Omit<StoredMember, "id" | "intro_ok" | "closed" | "chat_joined" | "group_link_sent_at"> & Partial<StoredMember>): StoredMember {
  const existing = memberOf(s, m.case_id);
  const next: StoredMember = { id: m.case_id, intro_ok: [], closed: [], chat_joined: false, group_link_sent_at: null, ...existing, ...m };
  s.members = [...s.members.filter((x) => x.case_id !== m.case_id), next];
  return next;
}

export type ClosedStep = { step: Step; weeks: number; on: string };
