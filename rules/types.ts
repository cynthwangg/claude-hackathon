export type Lang = "en" | "es" | "zh";
export type L10n = { en: string; es: string; zh?: string };

export type FactState = "official" | "checked" | "from_document";
export type ReqState = FactState | "missing" | "unknown";

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { fact: string; exists: boolean }
  | { fact: string; eq: unknown }
  | { fact: string; in: unknown[] }
  | { fact: string; contains_any: string[] }
  | { fact: string; before: string }
  | { fact: string; gte: number };

export type Outcome =
  | { state: "satisfied"; evidence?: string[] }
  | { state: "missing"; reason: string; evidence?: string[] }
  | { state: "unknown"; question: string; evidence?: string[] };

export type Case = { when: Cond } & Outcome;

export type Logic = {
  cases: Case[];
  otherwise: Outcome;
};

export type Rule = {
  id: string;
  pathway_id: string;
  phase: "A" | "B" | "C";
  kind: "requirement" | "process" | "bridge" | "informational";
  title: L10n;
  excerpt: string;
  source_title: string;
  source_url: string;
  retrieved_on: string;
  verified_by: string | null;
  verified_on: string | null;
  effective_on?: string;
  decider: L10n;
  discretion: boolean;
  hard: boolean;
  quiet?: boolean;
  route_only?: boolean;
  logic?: Logic;
};
