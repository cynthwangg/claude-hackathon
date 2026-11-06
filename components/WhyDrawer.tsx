"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate, t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";
import { api } from "./api";
import s from "./position/why.module.css";

type Evidence = { document_id: string | null; kind: string | null; label: string; quote: string | null; page: number | null; statement: boolean };

type Why = {
  rule_id: string;
  asks: string;
  excerpt: string;
  source_title: string;
  source_url: string;
  read_on: string;
  evidence: Evidence[];
  decider: string;
  discretion: boolean;
  related: string[];
};

type Live = { result: "found" | "not_found" | "fetch_failed"; checked_at: string };

/** Lines read from the same document, label and page sit together under one thumbnail. */
function group(evidence: Evidence[]) {
  const out: { key: string; e: Evidence; quotes: string[] }[] = [];
  for (const e of evidence) {
    const key = `${e.document_id}|${e.label}|${e.page}|${e.statement}`;
    const g = out.find((x) => x.key === key);
    if (g) { if (e.quote) g.quotes.push(e.quote); }
    else out.push({ key, e, quotes: e.quote ? [e.quote] : [] });
  }
  return out;
}

/** 6.10. The whole trust model in one component. Scrim, Escape, focus trap, scroll lock, focus returns (F4). */
export function WhyDrawer({ caseId, lang, ruleId, onClose }: { caseId: string; lang: Lang; ruleId: string | null; onClose: () => void }) {
  const [why, setWhy] = useState<Why | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [live, setLive] = useState<Live | "checking" | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const asked = useRef(new Set<string>());
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  const current = stack[stack.length - 1] ?? ruleId;

  useEffect(() => {
    if (!ruleId) return;
    opener.current = document.activeElement as HTMLElement;
    setStack([ruleId]);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close.current(); } };
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
      setStack([]);
      opener.current?.focus();
    };
  }, [ruleId]);

  useEffect(() => {
    if (!current) return;
    setWhy(null);
    setLive(null);
    api<Why>(`/api/cases/${caseId}/why/${current}`).then(setWhy).catch(() => setWhy(null));
  }, [caseId, current]);

  useEffect(() => {
    if (!why) return;
    panel.current?.querySelector<HTMLElement>("h2")?.focus();
    for (const r of why.related) {
      if (asked.current.has(r)) continue;
      asked.current.add(r);
      api<Why>(`/api/cases/${caseId}/why/${r}`).then((x) => setTitles((m) => ({ ...m, [r]: x.asks }))).catch(() => asked.current.delete(r));
    }
  }, [why, caseId]);

  const onTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), h2[tabindex]")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!ruleId) return null;

  const check = async () => {
    if (!why) return;
    setLive("checking");
    try {
      setLive(await api<Live>(`/api/rules/${why.rule_id}/live`));
    } catch {
      setLive({ result: "fetch_failed", checked_at: new Date().toISOString() });
    }
  };

  const when = (iso: string) => `${fmtDate(lang, iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString(lang === "zh" ? "zh-CN" : lang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" })}`;
  const related = why ? why.related.filter((r) => titles[r]) : [];

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className={`drawer ${s.sheet}`} role="dialog" aria-modal="true" aria-labelledby="why-title" ref={panel} tabIndex={-1} onKeyDown={onTab} lang={lang}>
        <div className={`sans ${s.top}`}>
          {stack.length > 1 && <button className="link muted" onClick={() => setStack((x) => x.slice(0, -1))}>{t(lang, "why.back")}</button>}
          <button className="link" onClick={onClose}>{t(lang, "why.close")}</button>
        </div>
        {!why ? (
          <p className="muted">{t(lang, "position.updating")}</p>
        ) : (
          <>
            <h3>{t(lang, "why.asks")}</h3>
            <h2 id="why-title" className={s.ask} tabIndex={-1}>{why.asks}</h2>

            <h3>{t(lang, "why.where")}</h3>
            <blockquote className={s.quote} lang="en">“{why.excerpt}”</blockquote>
            <p className={`micro ${s.source}`}>{why.source_title} · {t(lang, "why.read_on", { date: why.read_on })}</p>
            <div className={`sans ${s.actions}`}>
              <a href={why.source_url} target="_blank" rel="noreferrer">{t(lang, "why.open_page")}</a>
              <button className="link" onClick={check} disabled={live === "checking"}>{t(lang, "why.live")}</button>
            </div>
            {live === "checking" && <p className="micro" role="status">{t(lang, "why.live_checking")}</p>}
            {live && live !== "checking" && (
              <p className="small" role="status">
                {live.result === "found" ? t(lang, "why.live_found", { when: when(live.checked_at) }) : live.result === "not_found" ? t(lang, "why.live_not_found") : t(lang, "why.live_failed", { date: why.read_on })}
              </p>
            )}

            <h3>{t(lang, "why.saw")}</h3>
            {why.evidence.length === 0 ? (
              <p className="small muted">{t(lang, "why.saw_none")}</p>
            ) : (
              <div>
                {group(why.evidence).map(({ key, e, quotes }) => {
                  const thumb = e.document_id && !e.statement;
                  return (
                    <div key={key} className={`small ${s.ev} ${thumb ? "" : s.solo}`}>
                      <div>
                        {e.statement ? (
                          <span className="muted">{t(lang, "why.statement")}</span>
                        ) : (
                          <>
                            <div className={s.quotes}>{quotes.map((q) => <div key={q}><span className="mark">{q}</span></div>)}</div>
                            <div className="micro" style={{ marginTop: 4 }}>{e.label}{e.page ? ` · ${t(lang, "why.page", { n: e.page })}` : ""}</div>
                          </>
                        )}
                      </div>
                      {thumb && (
                        <a className={s.thumb} href={`/api/files/${e.document_id}`} target="_blank" rel="noreferrer">
                          <img src={`/api/files/${e.document_id}?preview=1`} alt={e.label} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <h3>{t(lang, "why.decides")}</h3>
            <p className="small">{why.decider}. {why.discretion ? t(lang, "why.discretion") : t(lang, "why.no_discretion")}</p>

            {related.length > 0 && (
              <>
                <h3>{t(lang, "why.related")}</h3>
                <div className={`sans ${s.related}`}>
                  {related.map((r) => <button key={r} className="link" onClick={() => setStack((x) => [...x, r])}>{titles[r]}</button>)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
