import en from "@/locales/en.json";
import es from "@/locales/es.json";
import zh from "@/locales/zh.json";
import type { Lang } from "@/rules/types";

const TABLE: Record<Lang, Record<string, string>> = { en, es, zh };

export const LANGS: Lang[] = ["en", "es", "zh"];
export const asLang = (s: string | null | undefined): Lang => (s === "es" || s === "zh" ? s : "en");

export function has(lang: Lang, key: string) {
  return key in TABLE[lang] || key in TABLE.en;
}

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = TABLE[lang][key] ?? TABLE.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function joinList(lang: Lang, items: string[]) {
  if (items.length <= 1) return items.join("");
  const and = t(lang, "join.and");
  if (lang === "zh") return items.slice(0, -1).join("、") + and + items[items.length - 1];
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fmtDate(lang: Lang, iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m) return String(y);
  if (lang === "zh") return d ? `${y} 年 ${m} 月 ${d} 日` : `${y} 年 ${m} 月`;
  if (lang === "es") return d ? `${d} de ${MONTHS_ES[m - 1]} de ${y}` : `${MONTHS_ES[m - 1]} de ${y}`;
  return d ? `${MONTHS_EN[m - 1]} ${d}, ${y}` : `${MONTHS_EN[m - 1]} ${y}`;
}

export const dict = (lang: Lang) => ({ ...TABLE.en, ...TABLE[lang] });
