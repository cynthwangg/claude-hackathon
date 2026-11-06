"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDate, t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";
import { api } from "./api";

type Why = {
  rule_id: string;
  asks: string;
  excerpt: string;
  source_title: string;
  source_url: string;
  read_on: string;
  evidence: { document_id: string | null; kind: string | null; label: string; quote: string | null; page: number | null; statement: boolean }[];
  decider: string;
  discretion: boolean;
  related: string[];
};

type Live = { result: "found" | "not_found" | "fetch_failed"; checked_at: string };

/** 6.10. The whole trust model in one component. Scrim, Escape, focus trap, scroll lock, focus returns (F4). */
export function WhyDrawer({ caseId, lang, ruleId, onClose }: { caseId: string; lang: Lang; ruleId: string | null; onClose: () => void }) {
  const [why, setWhy] = useState<Why | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [live, setLive] = useState<Live | "checking" | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const current = stack[stack.length - 1] ?? ruleId;

  useEffect(() => {
    if (!ruleId) return;
    opener.current = document.activeElement as HTMLElement;
    setStack([ruleId]);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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
    if (why) panel.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [why]);

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("a[href], button, [tabindex='0'], h2[tabindex]")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
    [onClose],
  );

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

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="why-title" ref={panel} onKeyDown={onKey} lang={lang}>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
          <span className="micro">{why?.rule_id ?? ""}</span>
          <button className="link sans" onClick={onClose}>{t(lang, "why.close")}</button>
        </div>
        {!why ? (
          <p className="muted">{t(lang, "position.updating")}</p>
        ) : (
          <>
            <h3>{t(lang, "why.asks")}</h3>
            <h2 id="why-title" tabIndex={-1} style={{ marginTop: 0, outline: "none" }}>{why.asks}</h2>

            <h3>{t(lang, "why.where")}</h3>
            <p className="small"><span className="quote" lang="en">“{why.excerpt}”</span></p>
            <p className="micro">
              {why.source_title} · {t(lang, "why.read_on", { date: why.read_on })} · <a href={why.source_url} target="_blank" rel="noreferrer">{t(lang, "why.open")}</a>
            </p>
            <div className="row sans" style={{ marginTop: 6 }}>
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
              why.evidence.map((e, i) => (
                <div key={i} className="item small" style={{ alignItems: "flex-start" }}>
                  <span>
                    {e.statement ? <span className="muted">{t(lang, "why.statement")}</span> : (
                      <>
                        <span className="muted">{e.label}{e.page ? ` · ${lang === "es" ? "página" : lang === "zh" ? "第" : "page"} ${e.page}${lang === "zh" ? " 页" : ""}` : ""} · </span>
                        {e.quote && <span className="mark">{e.quote}</span>}
                      </>
                    )}
                  </span>
                  {e.document_id && !e.statement && <img className="thumb" src={`/api/files/${e.document_id}?preview=1`} alt="" />}
                </div>
              ))
            )}

            <h3>{t(lang, "why.decides")}</h3>
            <p className="small">{why.decider}. {why.discretion ? t(lang, "why.discretion") : t(lang, "why.no_discretion")}</p>

            {why.related.length > 0 && (
              <>
                <h3>{t(lang, "why.related")}</h3>
                <div className="row sans" style={{ marginTop: 0 }}>
                  {why.related.map((r) => <button key={r} className="link" onClick={() => setStack((s) => [...s, r])}>{r}</button>)}
                  {stack.length > 1 && <button className="link muted" onClick={() => setStack((s) => s.slice(0, -1))}>{t(lang, "why.back")}</button>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
