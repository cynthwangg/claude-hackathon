import type { Lang } from "@/rules/types";

export type Header = {
  id: string;
  lang: Lang;
  name: string | null;
  route_kind: "match" | "near" | "none";
  pathway: { id: string; title: string; orientation: string } | null;
  general_orientation: string;
  office: { name: string; url: string; source: "table" | "search"; cited?: string } | null;
  mock: boolean;
  today: string;
};

export type Line = { rule_id: string; state: string; state_word: string; text: string };
