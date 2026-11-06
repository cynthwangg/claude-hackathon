"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { t } from "@/lib/i18n";
import type { Turn } from "@/lib/intake/types";
import s from "../opener.module.css";

type Pick = "case" | "roles" | "visa" | "resume";
type CaseResp = { header: Header; history: Turn[]; topic: string | null; done: boolean };
type AgentResp = { reply: { kind: string; say: string | null; topic: string | null }; history: Turn[]; topic: string | null };

const PICKS: Pick[] = ["case", "roles", "visa", "resume"];

/** The shared agent on the web. The thread is the same one she has on WhatsApp, so either side continues the other. */
export default function Ask() {
  const { id } = useParams<{ id: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [intakeDone, setIntakeDone] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<CaseResp>(`/api/cases/${id}`)
      .then((r) => {
        setHeader(r.header);
        setTurns(r.history);
        setTopic(r.topic);
        setIntakeDone(r.done);
      })
      .catch((e) => setErr(errorKey(e)));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), [turns.length, busy]);

  const send = useCallback(
    async (json: { text: string } | { pick: Pick }) => {
      if (busy) return;
      setBusy(true);
      setErr(null);
      if ("text" in json) setTurns((ts) => [...ts, { role: "user", text: json.text }]);
      try {
        const r = await api<AgentResp>(`/api/cases/${id}/agent`, { method: "POST", json });
        setTurns(r.history);
        setTopic(r.topic);
        if ("text" in json) setText("");
        if (r.reply.kind === "intake_done") setIntakeDone(true);
      } catch (e) {
        if ("text" in json) setTurns((ts) => ts.slice(0, -1));
        setErr(errorKey(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, id],
  );

  if (!header) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const lang = header.lang;
  const current = topic && topic !== "menu" ? topic : "case";

  return (
    <Shell id={id} lang={lang} name={header.name} active="ask" routeKind={header.route_kind} mock={header.mock}>
      <h1>{t(lang, "ask.title")}</h1>
      <p className="muted small">{t(lang, "ask.lead")}</p>

      <nav aria-label={t(lang, "ask.topics")} className="sans" style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", margin: "8px 0 20px" }}>
        {PICKS.map((p) => (
          <button key={p} type="button" className={current === p ? "link" : "link muted"} aria-pressed={current === p} disabled={busy} onClick={() => send({ pick: p })}>
            {t(lang, `agent.topic.${p}`)}
          </button>
        ))}
      </nav>

      <div aria-live="polite" style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
        {turns.length === 0 && <p className="muted">{t(lang, "ask.empty")}</p>}
        {turns.map((tu, i) => (
          <p key={i} className={tu.role === "user" ? "turn her" : "turn"} style={{ whiteSpace: "pre-line" }}>{tu.text}</p>
        ))}
        {busy && <p className="muted">{t(lang, "ask.thinking")}</p>}
        {intakeDone && turns.length > 0 && current === "case" && turns[turns.length - 1].role === "user" && !busy && (
          <p className="sans"><Link href={`/c/${id}`}>{t(lang, "agent.intake_done_web")}</Link></p>
        )}
        <div ref={end} />
      </div>

      <form className={s.form} onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ text: text.trim() }); }}>
        <label className="sr" htmlFor="ask">{t(lang, "ask.title")}</label>
        <textarea
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(lang, `ask.placeholder.${current}`)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (text.trim()) send({ text: text.trim() });
            }
          }}
        />
        <div className={s.actions}>{text.trim() && !busy && <button className="btn" type="submit">{t(lang, "ask.send")}</button>}</div>
      </form>
      {err && <ErrorLine lang={lang} k={err} />}
    </Shell>
  );
}
