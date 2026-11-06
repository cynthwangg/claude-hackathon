import { pathways, type Pathway } from "@/data/pathways";
import type { Intake } from "./types";

export type RouteKind = "match" | "near" | "none";
export type Routing = { kind: RouteKind; pathway: Pathway | null; reason: "matched" | "near" | "no_pathway" | "unknown_state" };

/** Deterministic. Never defaults a missing state to California (D21). */
export function routeIntake(i: Intake): Routing {
  if (!i.us_state) return { kind: "none", pathway: null, reason: "unknown_state" };
  const fits = (p: Pathway) => !!i.profession && p.match.professions.includes(i.profession) && p.match.states.includes(i.us_state!);
  const candidates = pathways.filter(fits);
  const deep = candidates.find((p) => p.depth === "deep" && (p.match.levels ?? [null]).includes(i.level ?? null));
  if (deep) return { kind: "match", pathway: deep, reason: "matched" };
  const near = candidates.find((p) => p.depth === "partial" && (p.match.levels ?? []).includes(i.level ?? null));
  if (near) return { kind: "near", pathway: near, reason: "near" };
  return { kind: "none", pathway: null, reason: "no_pathway" };
}

export function requestOrder(i: Intake, kind: RouteKind): string[] {
  const order: string[] = [];
  if (kind !== "none" && i.stage === "applied_letter_received") order.push("ctc_letter");
  if (i.stage === "evaluation_in_hand" || i.stage === "applied_letter_received") order.push("evaluation_report");
  order.push("transcript", "degree", "license", "experience");
  return order;
}
