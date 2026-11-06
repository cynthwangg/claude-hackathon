import { describe, expect, it } from "vitest";
import { programById } from "@/data/programs";
import { addDays } from "@/lib/clock";
import { agree, circleFor, circlePosts, countAsk, introCandidate, introMessages, joinOffer, joinReply, peerTiming, seed, type Intro } from "@/lib/circle";
import { matchWord, makeOffer, receipt, sha256, wordOf } from "@/lib/confirm";
import { COPY } from "@/lib/copy";
import { analyze } from "@/lib/engine/analyze";
import { FactIndex } from "@/lib/facts";
import { ELIGIBILITY_CLAIM, EM_DASH } from "@/lib/guard";
import { emptyMemory, lead, nudgesFor, snapshotOf } from "@/lib/proactive";
import { exportable, leaks, type ShareSource } from "@/lib/privacy";
import { checkProgram, matchProgram, metroFor, publicText as registryText } from "@/lib/programs";
import { golden, marianaRows, marianaStated, TODAY } from "./helpers";

const MX = programById("mx_sep_lep_1997")!;
const CN = programById("cn_moe_teacher_ed_2011")!;
const idx = (rows = marianaRows()) => new FactIndex(rows, { today: TODAY, stated: marianaStated });
const publicText = registryText();
const { circles, members } = seed();

describe("program registry", () => {
  it("matches Mariana from her documents", () => {
    expect(matchProgram(idx(), { country_of_training: "Mexico" })?.id).toBe("mx_sep_lep_1997");
  });

  it("matches Mariana from her first WhatsApp message alone", () => {
    const text = "Soy Mariana, maestra en Guadalajara, Normal de Jalisco, me gradué en 2010, vivo en San José y la CTC me regresó la solicitud.";
    expect(matchProgram(null, { country_of_training: "Mexico", text })?.id).toBe("mx_sep_lep_1997");
  });

  it("does not guess without a year or a plan", () => {
    expect(matchProgram(null, { country_of_training: "Mexico", text: "Estudié en la Normal de Jalisco" })).toBeNull();
  });

  it("matches Lin Wei from her transcript", () => {
    const rows = golden("linwei/01-chengjidan");
    expect(matchProgram(new FactIndex(rows, { today: TODAY, stated: {} }), { country_of_training: "China" })?.id).toBe("cn_moe_teacher_ed_2011");
  });

  it("expects, then confirms, and never wins over her paper", () => {
    expect(checkProgram(MX, null)[0].status).toBe("expected");
    const ok = checkProgram(MX, idx())[0];
    expect(ok.status).toBe("confirmed");
    expect(ok.found).toEqual(["Trabajo Docente I", "Trabajo Docente II"]);
    const none = checkProgram(MX, new FactIndex(golden("edge/transcript-no-practicum"), { today: TODAY, stated: {} }))[0];
    expect(none.status).toBe("contradicted");
  });

  it("never shows a number of weeks for the Chinese program", () => {
    expect(JSON.stringify(CN)).not.toMatch(/\d+\s*(weeks|周)/);
  });

  it("maps cities to metros", () => {
    expect(metroFor("San José")).toBe("sf_bay_area");
    expect(metroFor("Alhambra")).toBe("la");
    expect(metroFor("Houston")).toBeNull();
  });
});

describe("circle", () => {
  it("counts only opted-in members, never fewer than two", () => {
    const offer = joinOffer("en", members, MX, "sf_bay_area")!;
    expect(offer[0]).toMatch(/^3 women/);
    expect(offer[1]).toContain("everyone sees everyone's number");
    expect(joinOffer("en", members.slice(0, 1), MX, "sf_bay_area")).toBeNull();
    expect(joinOffer("en", members, MX, "la")).toBeNull();
  });

  it("sends a link only when the group exists", () => {
    expect(joinReply("es", circleFor(circles, MX.id, "sf_bay_area"), MX, "sf_bay_area", "http://x/circle")).toContain("todavía se está armando");
    expect(joinReply("en", { ...circles[0], invite_link: "https://chat.whatsapp.com/abc" }, MX, "sf_bay_area", "http://x/circle")).toContain("https://chat.whatsapp.com/abc");
  });

  it("tells her how long the school letter took others, as a range", () => {
    expect(peerTiming("en", members, MX.id, "sf_bay_area", "school_letter", 38)).toBe(
      "3 women from your program got the letter from the school. It took them 2 to 4 weeks. If you ask this week, it should arrive before your deadline.",
    );
    expect(peerTiming("en", members, MX.id, "sf_bay_area", "school_letter", 20)).toContain("close to your deadline");
    expect(peerTiming("en", members, MX.id, "sf_bay_area", "ctc_reply", 20)).toBeNull();
  });

  it("offers an introduction only to someone who volunteered for that step", () => {
    expect(introCandidate(members, MX.id, "sf_bay_area", "school_letter")?.id).toBe("seed_rosa");
    expect(introCandidate(members, MX.id, "sf_bay_area", "ctc_reply")).toBeNull();
  });

  it("sends nothing until both sides say INTRO", () => {
    const share = (id: string, phone: string, counted = true): ShareSource & { lang: "en" } => ({ lang: "en", program_id: MX.id, metro: "sf_bay_area", first_name: id, phone, counted, years_experience: 10, level: "elementary", profession: "teacher" });
    const now = TODAY;
    let intro: Intro = { id: "i1", a: "mariana", b: "seed_rosa", step: "school_letter", a_agreed_at: null, b_agreed_at: null, sent_at: null };
    intro = agree(intro, "mariana", now);
    expect(introMessages(intro, share("Mariana", "whatsapp:+15550001111"), share("Rosa", "whatsapp:+15550002001"))).toBeNull();
    intro = agree(intro, "seed_rosa", now);
    const out = introMessages(intro, share("Mariana", "whatsapp:+15550001111"), share("Rosa", "whatsapp:+15550002001"))!;
    expect(out.toA).toContain("+15550002001");
    expect(out.toA).not.toContain("whatsapp:");
    expect(introMessages(intro, share("Mariana", "whatsapp:+15550001111", false), share("Rosa", "whatsapp:+15550002001"))).toBeNull();
  });

  it("posts program facts and weekly counts, nothing from any case", () => {
    const posts = circlePosts("es", MX, members, "sf_bay_area", TODAY);
    expect(posts.some((p) => p.includes("Trabajo Docente I"))).toBe(true);
    expect(posts.some((p) => p.startsWith("2 integrantes consiguieron la carta de la escuela"))).toBe(true);
    for (const p of posts) expect(leaks(p, marianaRows(), publicText)).toEqual([]);
  });
});

describe("privacy", () => {
  const her: ShareSource = { program_id: MX.id, metro: "sf_bay_area", first_name: "Mariana", phone: "whatsapp:+15550001111", counted: false, years_experience: 10, level: "elementary", profession: "teacher" };

  it("lets nothing out for a member who did not opt in", () => {
    expect(exportable("circle_count", her)).toBeNull();
    expect(exportable("introduction", her)).toBeNull();
    expect(exportable("circle_count", { ...her, counted: true })).toEqual({ kind: "circle_count", program_id: MX.id, metro: "sf_bay_area" });
  });

  it("finds her printed values in a text meant for others", () => {
    expect(leaks("Hola, soy de la ESCUELA NORMAL DE EDUCACIÓN PRIMARIA DEL ESTADO DE JALISCO", marianaRows(), publicText).length).toBeGreaterThan(0);
    expect(leaks(countAsk("es", "Mariana", MX, "sf_bay_area"), marianaRows(), publicText)).toEqual([]);
  });
});

describe("confirmations", () => {
  it("reads one-word replies in her language", () => {
    expect(wordOf("sí")).toBe("YES");
    expect(wordOf("Enviado.")).toBe("SENT");
    expect(wordOf("加入")).toBe("JOIN");
    expect(wordOf("yes please send it")).toBeNull();
  });

  it("acts on the latest offer within 24 hours, re-offers after", () => {
    const o = makeOffer("SENT", "mark_sent", "When you have sent the letter...", TODAY);
    expect(matchWord("SENT", [o], addDays(TODAY, 0.5))?.kind).toBe("act");
    expect(matchWord("SENT", [o], addDays(TODAY, 1.5))?.kind).toBe("expired");
    expect(matchWord("JOIN", [o], TODAY)).toBeNull();
    expect(o.text_hash).toBe(sha256("When you have sent the letter..."));
  });

  it("writes a receipt in her language and in English, with the fingerprint", () => {
    const r = receipt("es", { on: "2026-11-06", doc: "la carta de Servicios Escolares", pages: 1, file_sha256: sha256("pdf bytes"), to: "la agencia", method: "email" });
    expect(r).toContain(sha256("pdf bytes").slice(0, 12));
    expect(r).toContain("6 de noviembre de 2026");
    expect(r).toContain("November 6, 2026");
  });
});

describe("proactive", () => {
  const a = analyze(marianaRows(), marianaStated, TODAY);
  const base = { lang: "en" as const, analysis: a, actions: [], letterUrl: (k: string) => `http://x/c/1/letter/${k}`, program: MX, metro: "sf_bay_area", members };

  it("leads with the deadline once per threshold", () => {
    const first = nudgesFor({ ...base, memory: emptyMemory() });
    expect(first.nudges.find((n) => n.kind === "deadline")?.text).toMatch(/days left to answer the CTC letter/);
    const again = nudgesFor({ ...base, memory: first.memory });
    expect(again.nudges.find((n) => n.kind === "deadline")).toBeUndefined();
  });

  it("says what moved since she last wrote", () => {
    const have = a.requirements.find((r) => r.state === "from_document")!;
    const r = nudgesFor({ ...base, memory: { snapshot: { ...snapshotOf(a), [have.rule_id]: "missing" }, deadline_sent: [45, 30, 14, 7, 3] } });
    const moved = r.nudges.filter((n) => n.kind === "arrived");
    expect(moved).toHaveLength(1);
    expect(moved[0].text).toContain("From your document");
    expect(nudgesFor({ ...base, memory: { snapshot: snapshotOf(a), deadline_sent: [] } }).nudges.filter((n) => n.kind === "arrived")).toHaveLength(0);
  });

  it("points at what is written and what others went through, in at most two messages", () => {
    const r = nudgesFor({ ...base, memory: emptyMemory(), actions: [{ kind: "request_school_letter", state: "not_started", draft_primary: "Estimada..." }] });
    const msgs = lead(r.nudges);
    expect(msgs.length).toBeLessThanOrEqual(2);
    expect(msgs[0]).toContain("http://x/c/1/letter/request_school_letter");
    expect(msgs[1]).toContain("2 to 4 weeks");
    expect(leaks(msgs[1], marianaRows(), publicText)).toEqual([]);
  });
});

describe("copy rules", () => {
  it("has three languages, the same placeholders, and none of the forbidden forms", () => {
    for (const [key, row] of Object.entries(COPY)) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
      expect(row.zh, key).toBeTruthy();
      for (const s of [row.en, row.es, row.zh!]) {
        expect(vars(s), key).toBe(vars(row.en));
        expect(EM_DASH.test(s), key).toBe(false);
        expect(ELIGIBILITY_CLAIM.test(s), key).toBe(false);
        expect(/[!！:：]/.test(s), key).toBe(false);
      }
    }
  });
});
