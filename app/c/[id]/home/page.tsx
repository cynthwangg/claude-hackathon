"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { say } from "@/lib/copy";
import { t } from "@/lib/i18n";

type Step = { kind: string; text: string; why: string; has_draft: boolean };
type Community = {
  state: "none" | "open" | "joined";
  group_name: string | null;
  group_link: string | null;
  count_line: string | null;
  chat_joined: boolean;
  in_group: boolean;
  synthetic: boolean;
  circle_url: string;
};
type Portal = {
  header: Header;
  connected: { whatsapp: string | null };
  wa_link: string;
  since: string[];
  week: { headline: Step; why_now: string | null; also: Step[] } | null;
  did: string[];
  community: Community;
};

/** The case portal. What changed, what to do this week, what Earned did, and the people from her program. */
export default function Home() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Portal | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const once = useRef(false);

  const load = useCallback(() => api<Portal>(`/api/cases/${id}/portal`).then(setData).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    load();
  }, [load]);

  if (!data) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const { header, community: cm, week } = data;
  const lang = header.lang;

  const act = async (action: string, then?: string) => {
    setBusy(true);
    try {
      await api(`/api/cases/${id}/community`, { method: "POST", json: { action } });
      if (then) router.push(then);
      else await load();
    } catch (e) {
      setErr(errorKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell id={id} lang={lang} name={header.name} routeKind={header.route_kind} mock={header.mock}>
      <section className="section first">
        <h1 style={{ marginTop: 0 }}>{header.name ? say(lang, "portal.title", { name: header.name }) : say(lang, "portal.title_noname")}</h1>
        <p className="small">{data.connected.whatsapp ? say(lang, "portal.saved_wa", { last4: data.connected.whatsapp }) : say(lang, "portal.saved_web")}</p>
        <a className="link sans" href={data.wa_link} target="_blank" rel="noreferrer">{say(lang, data.connected.whatsapp ? "portal.open_wa" : "portal.connect_wa")}</a>
      </section>

      <section className="section">
        <h2>{say(lang, "portal.since")}</h2>
        {data.since.length ? data.since.map((s) => <p key={s}>{s}</p>) : <p className="muted">{say(lang, "portal.nothing_new")}</p>}
      </section>

      {week && (
        <section className="section">
          <h2>{say(lang, "portal.week")}</h2>
          <p style={{ marginBottom: 4 }}>{week.headline.text}</p>
          <p className="small muted">{week.headline.why}</p>
          {week.why_now && <p className="small">{week.why_now}</p>}
          <div className="row">
            {week.headline.has_draft
              ? <Link className="btn" href={`/c/${id}/letter/${week.headline.kind}`}>{t(lang, `draft.${week.headline.kind}`)}</Link>
              : <Link className="btn" href={`/c/${id}/week`}>{t(lang, "nav.week")}</Link>}
          </div>
          {week.also.length > 0 && (
            <>
              <p className="label" style={{ marginTop: 18 }}>{say(lang, "portal.also")}</p>
              {week.also.map((s) => (
                <div key={s.kind} className="item small">
                  <span>{s.text}</span>
                  {s.has_draft && <Link className="link sans" href={`/c/${id}/letter/${s.kind}`}>{t(lang, `draft.${s.kind}`)}</Link>}
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {data.did.length > 0 && (
        <section className="section">
          <h2>{say(lang, "portal.did")}</h2>
          {data.did.map((d) => <div key={d} className="item small"><span>{d}</span></div>)}
        </section>
      )}

      <section className="section">
        <h2>{say(lang, "portal.people")}</h2>
        {cm.state === "none" && <p className="small muted">{say(lang, "portal.people.unknown")}</p>}
        {cm.count_line && <p>{cm.count_line}</p>}

        {cm.state !== "none" && cm.group_name && (
          <>
            {cm.state === "open" && <p className="small" style={{ marginTop: 12 }}>{say(lang, "portal.choose")}</p>}
            <div className="item small" style={{ display: "block" }}>
              <p style={{ marginBottom: 4 }}>{say(lang, "portal.chat_option")}</p>
              {cm.chat_joined
                ? <Link className="link sans" href={cm.circle_url}>{say(lang, "portal.open_circle")}</Link>
                : <button className="link sans" disabled={busy} onClick={() => act("chat_join", cm.circle_url)}>{say(lang, "portal.chat_button")}</button>}
            </div>
            {cm.group_link && (
              <div className="item small" style={{ display: "block" }}>
                <p style={{ marginBottom: 4 }}>{say(lang, "portal.group_option", { name: cm.group_name })}</p>
                <a className="link sans" href={cm.group_link} target="_blank" rel="noreferrer" onClick={() => { if (!cm.in_group) act("group"); }}>{say(lang, "portal.group_button")}</a>
              </div>
            )}
            {cm.state === "joined" && <div className="row sans"><button className="link muted" disabled={busy} onClick={() => act("leave")}>{say(lang, "portal.leave")}</button></div>}
          </>
        )}
        {cm.synthetic && cm.count_line && <p className="micro" style={{ marginTop: 12 }}>{say(lang, "portal.synthetic")}</p>}
      </section>
    </Shell>
  );
}
