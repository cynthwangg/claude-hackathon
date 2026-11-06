import seedData from "@/data/circles.json";
import type { Program } from "@/data/programs";
import type { Lang } from "@/rules/types";
import { addDays, parseDay } from "./clock";
import { COPY, say, sayL10n, type CopyKey } from "./copy";
import { joinList } from "./i18n";
import { exportable, type ShareSource } from "./privacy";

/**
 * Sections 35 and 36. Pure functions over circles and members. Storage comes later (Circle, CircleMember, Intro
 * in section 37); until then the hand made circles and the synthetic members live in data/circles.json.
 * Nothing here reads a case. A member is program, metro, first name, number, and the steps she chose to report.
 */
export type Step = "school_letter" | "evaluation" | "ctc_reply" | "live_scan";
export type Member = {
  id: string;
  synthetic?: boolean;
  first_name: string | null;
  phone: string | null;
  program_id: string;
  metro: string;
  counted: boolean;
  /** Steps she agreed to be introduced for, as the one further along. */
  intro_ok: Step[];
  closed: { step: Step; weeks: number; on: string }[];
};
export type Circle = { id: string; program_id: string; metro: string; tier: "manual" | "groups_api" | "relay"; invite_link: string | null };

export const seed = () => ({ circles: seedData.circles as Circle[], members: seedData.members as Member[] });

/** Never a number below two. Below that the line is not said at all, so no one can be singled out. */
export const MIN_COUNT = 2;

export const peersOf = (members: Member[], programId: string, metro: string, excludeId?: string) =>
  members.filter((m) => m.counted && m.program_id === programId && m.metro === metro && m.id !== excludeId);

export const circleFor = (circles: Circle[], programId: string, metro: string) => circles.find((c) => c.program_id === programId && c.metro === metro) ?? null;

export const metroName = (lang: Lang, metro: string) => (`metro.${metro}` in COPY ? say(lang, `metro.${metro}` as CopyKey) : metro);

/** The opt-in ask, once, at the end of her first position. */
export const countAsk = (lang: Lang, name: string, program: Program, metro: string) =>
  say(lang, "count.ask", { name, program: sayL10n(lang, program.short), metro: metroName(lang, metro) });

/** The JOIN offer. Two messages, the count then the consent copy. Null when fewer than two others are counted. */
export function joinOffer(lang: Lang, members: Member[], program: Program, metro: string, selfId?: string): string[] | null {
  const n = peersOf(members, program.id, metro, selfId).length;
  if (n < MIN_COUNT) return null;
  return [say(lang, "count.line", { count: n, program: sayL10n(lang, program.short), metro: metroName(lang, metro) }), say(lang, "join.offer")];
}

export function joinReply(lang: Lang, circle: Circle | null, program: Program, metro: string, pageUrl: string): string {
  if (!circle?.invite_link) return say(lang, "join.no_link", { program: sayL10n(lang, program.short), metro: metroName(lang, metro) });
  return say(lang, "join.link", { link: circle.invite_link, page: pageUrl });
}

/**
 * Proactive and social at once. How long a step took others from her program, from at least two members who
 * reported it, as a range of whole weeks. With her deadline, one more line on whether asking now fits.
 */
export function peerTiming(lang: Lang, members: Member[], programId: string, metro: string, step: Step, daysLeft?: number | null): string | null {
  const weeks = peersOf(members, programId, metro).flatMap((m) => m.closed.filter((c) => c.step === step).map((c) => Math.max(1, Math.round(c.weeks))));
  if (weeks.length < MIN_COUNT) return null;
  const low = Math.min(...weeks);
  const high = Math.max(...weeks);
  const stepName = say(lang, `step.${step}` as CopyKey);
  const line = low === high ? say(lang, "peer.timing_same", { count: weeks.length, step: stepName, low }) : say(lang, "peer.timing", { count: weeks.length, step: stepName, low, high });
  if (daysLeft === undefined || daysLeft === null || daysLeft < 0) return line;
  return `${line} ${say(lang, high * 7 <= daysLeft ? "peer.fits" : "peer.tight")}`;
}

/** Someone further along who said yes to being introduced for this step. The longest-standing volunteer first. */
export function introCandidate(members: Member[], programId: string, metro: string, step: Step, excludeId?: string): Member | null {
  const ok = peersOf(members, programId, metro, excludeId).filter((m) => m.intro_ok.includes(step) && m.closed.some((c) => c.step === step));
  return ok.sort((a, b) => (a.closed.find((c) => c.step === step)!.on < b.closed.find((c) => c.step === step)!.on ? -1 : 1))[0] ?? null;
}

export const introOffer = (lang: Lang, step: Step) => say(lang, "intro.offer", { step: say(lang, `step.${step}` as CopyKey) });
export const givebackAsk = (lang: Lang, step: Step) => say(lang, "giveback.ask", { step: say(lang, `step.${step}` as CopyKey) });

/** Section 35.3. Double opt in. Nothing is sent until both sides have said INTRO to the same offer. */
export type Intro = { id: string; a: string; b: string; step: Step; a_agreed_at: Date | null; b_agreed_at: Date | null; sent_at: Date | null };

export function agree(intro: Intro, who: string, now: Date): Intro {
  if (who === intro.a) return { ...intro, a_agreed_at: intro.a_agreed_at ?? now };
  if (who === intro.b) return { ...intro, b_agreed_at: intro.b_agreed_at ?? now };
  return intro;
}

/** Both messages, or null. Each side gets the other's first name and number, through the privacy table, and nothing else. */
export function introMessages(intro: Intro, a: ShareSource & { lang: Lang }, b: ShareSource & { lang: Lang }): { toA: string; toB: string } | null {
  if (!intro.a_agreed_at || !intro.b_agreed_at || intro.sent_at) return null;
  const ea = exportable("introduction", a);
  const eb = exportable("introduction", b);
  if (!ea || !eb || ea.kind !== "introduction" || eb.kind !== "introduction") return null;
  return {
    toA: say(a.lang, "intro.sent", { name: eb.first_name, phone: eb.phone.replace(/^whatsapp:/, "") }),
    toB: say(b.lang, "intro.sent", { name: ea.first_name, phone: ea.phone.replace(/^whatsapp:/, "") }),
  };
}

/**
 * Section 35.4. What Earned posts in a circle. Program facts from the registry, and progress as counts of two or more
 * in the last seven days. Nothing from any case, ever.
 */
export function circlePosts(lang: Lang, program: Program, members: Member[], metro: string, today: Date): string[] {
  const posts: string[] = [];
  for (const s of program.satisfies) {
    const must = joinList(lang, s.school_letter.must_state.map((k) => say(lang, `must.${k}` as CopyKey)));
    const courses = joinList(lang, s.expected_courses.map((c) => c.name));
    const source = `${say(lang, "program.source", { title: program.source.title })}${program.source.verified ? "" : ` ${say(lang, "program.unverified")}`}`;
    posts.push(`${say(lang, "circle.post.program", { program: sayL10n(lang, program.short), courses, office: s.school_letter.issuing_office, must })}\n${source}`);
  }
  const since = addDays(today, -7);
  const recent = new Map<Step, number>();
  for (const m of peersOf(members, program.id, metro)) for (const c of m.closed) if (parseDay(c.on) > since && parseDay(c.on) <= today) recent.set(c.step, (recent.get(c.step) ?? 0) + 1);
  for (const [step, n] of recent) if (n >= MIN_COUNT) posts.push(say(lang, "circle.post.progress", { count: n, step: say(lang, `step.${step}` as CopyKey) }));
  return posts;
}
