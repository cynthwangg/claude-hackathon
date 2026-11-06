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
    <Shell id={id} lang={lang} name={header.name} active="home" routeKind={header.route_kind} mock={header.mock}>
      <div className="plan">
        <div className="planmain">
          <h1>{header.name ? t(lang, "plan.title", { name: header.name }) : t(lang, "plan.title_noname")}</h1>

          {data.since.length > 0 && <div className="alert">{data.since.map((x) => <p key={x}>{x}</p>)}</div>}

          {week && (
            <section className="now">
              <p className="label">{t(lang, "plan.now")}</p>
              <h2>{week.headline.text}</h2>
              <p className="muted small">{week.headline.why}</p>
              <div className="row">
                {week.headline.has_draft
                  ? <Link className="btn" href={`/c/${id}/letter/${week.headline.kind}`}>{t(lang, `draft.${week.headline.kind}`)}</Link>
                  : <Link className="btn" href={`/c/${id}/week`}>{t(lang, "nav.week")}</Link>}
              </div>
            </section>
          )}

          {week && week.also.length > 0 && (
            <section>
              <h2>{t(lang, "plan.next")}</h2>
              <ol className="checklist">
                {week.also.map((x) => (
                  <li key={x.kind}>
                    <span>{x.text}</span>
                    {x.has_draft && <Link className="link sans" href={`/c/${id}/letter/${x.kind}`}>{t(lang, `draft.${x.kind}`)}</Link>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data.did.length > 0 && (
            <section>
              <h2>{t(lang, "plan.did")}</h2>
              <ul className="donelist">{data.did.map((d) => <li key={d}>{d}</li>)}</ul>
            </section>
          )}

          <p className="sans" style={{ marginTop: 28 }}><Link href={`/c/${id}/position`}>{t(lang, "plan.see_all")}</Link></p>
        </div>

        <aside className="sidecard" aria-labelledby="people">
          <p className="label">{t(lang, "nav.circle")}</p>
          <h2 id="people">{t(lang, "plan.people")}</h2>
          {cm.state === "none" && <p className="small muted">{say(lang, "portal.people.unknown")}</p>}
          {cm.count_line && <p className="small">{cm.count_line}</p>}
          {cm.state !== "none" && cm.group_link && (
            <a className="btn" href={cm.group_link} target="_blank" rel="noreferrer" onClick={() => { if (!cm.in_group) act("group"); }}>{t(lang, "plan.join_group")}</a>
          )}
          {cm.state !== "none" && (
            <p className="sans small" style={{ marginTop: 14 }}>
              {cm.chat_joined
                ? <Link href={cm.circle_url}>{say(lang, "portal.open_circle")}</Link>
                : <button className="link" disabled={busy} onClick={() => act("chat_join", cm.circle_url)}>{t(lang, "plan.chat_here")}</button>}
            </p>
          )}
          {cm.state === "joined" && <p className="sans small"><button className="link muted" disabled={busy} onClick={() => act("leave")}>{say(lang, "portal.leave")}</button></p>}
          {cm.synthetic && cm.count_line && <p className="micro">{say(lang, "portal.synthetic")}</p>}
          <hr />
          <a className="link sans small" href={data.wa_link} target="_blank" rel="noreferrer">{say(lang, data.connected.whatsapp ? "portal.open_wa" : "portal.connect_wa")}</a>
        </aside>
      </div>
    </Shell>
  );
}
