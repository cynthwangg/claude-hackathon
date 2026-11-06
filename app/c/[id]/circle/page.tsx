"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { say } from "@/lib/copy";

type Msg = { id: string; mine: boolean; name: string | null; text: string; at: string };
type View =
  | { header: Header; ready: false }
  | {
      header: Header;
      ready: true;
      title: string;
      chat_joined: boolean;
      group_link: string | null;
      posts: string[];
      chat: Msg[];
      count_line: string | null;
    };

const POLL_MS = 4000;

/** Her program's circle on the web. Earned's notes from public sources, and a conversation where others see first names only. */
export default function CirclePage() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<View>(`/api/cases/${id}/community`).then(setV).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!v) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const { header } = v;
  const lang = header.lang;

  const act = async (action: string, body?: string) => {
    setBusy(true);
    try {
      setV(await api<View>(`/api/cases/${id}/community`, { method: "POST", json: { action, text: body } }));
      if (action === "say") setText("");
    } catch (e) {
      setErr(errorKey(e));
    } finally {
      setBusy(false);
    }
  };

  const back = <Link className="link sans" href={`/c/${id}/home`}>{say(lang, "circle.back")}</Link>;

  if (!v.ready) {
    return (
      <Shell id={id} lang={lang} name={header.name} routeKind={header.route_kind} mock={header.mock}>
        <section className="section first"><p className="muted">{say(lang, "circle.not_ready")}</p>{back}</section>
      </Shell>
    );
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === "zh" ? "zh-CN" : lang, { hour: "2-digit", minute: "2-digit" });

  return (
    <Shell id={id} lang={lang} name={header.name} routeKind={header.route_kind} mock={header.mock}>
      <section className="section first">
        <h1 style={{ marginTop: 0 }}>{v.title}</h1>
        {v.count_line && <p className="small">{v.count_line}</p>}
        {v.group_link && <p className="small">{say(lang, "circle.on_whatsapp")} <a className="link sans" href={v.group_link} target="_blank" rel="noreferrer">{v.title}</a></p>}
        {back}
      </section>

      {v.posts.length > 0 && (
        <section className="section">
          <h2>{say(lang, "circle.notes")}</h2>
          {v.posts.map((p) => <p key={p} className="small" style={{ whiteSpace: "pre-line" }}>{p}</p>)}
          <p className="micro">{say(lang, "circle.from_earned")}</p>
        </section>
      )}

      <section className="section">
        <h2>{say(lang, "circle.chat")}</h2>
        {!v.chat_joined ? (
          <>
            <p className="small muted">{say(lang, "circle.not_joined")}</p>
            <button className="link sans" disabled={busy} onClick={() => act("chat_join")}>{say(lang, "portal.chat_button")}</button>
          </>
        ) : (
          <>
            {v.chat.length === 0 && <p className="small muted">{say(lang, "circle.empty")}</p>}
            {v.chat.map((m) => (
              <div key={m.id} className="item small">
                <span><span className="muted">{m.name ?? "?"} · </span>{m.text}</span>
                <span className="micro">{time(m.at)}</span>
              </div>
            ))}
            <form
              style={{ marginTop: 16 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) act("say", text);
              }}
            >
              <label className="sr" htmlFor="circle-text">{say(lang, "circle.placeholder")}</label>
              <textarea id="circle-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={say(lang, "circle.placeholder")} style={{ width: "100%", font: "inherit", padding: 10, border: "1px solid var(--muted)", background: "var(--field)", color: "var(--ink)", borderRadius: 0 }} />
              <div className="row">
                <button className="btn" type="submit" disabled={busy || !text.trim()}>{say(lang, "circle.send")}</button>
                <span className="micro">{say(lang, "circle.first_name_only")}</span>
              </div>
            </form>
            <div className="row sans"><button className="link muted" disabled={busy} onClick={() => act("chat_leave")}>{say(lang, "circle.leave_chat")}</button></div>
          </>
        )}
      </section>
    </Shell>
  );
}
