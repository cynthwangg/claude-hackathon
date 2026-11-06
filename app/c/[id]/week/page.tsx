"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { WhyDrawer } from "@/components/WhyDrawer";
import { t } from "@/lib/i18n";

type Step = { kind: string; text: string; why: string; action_id: string | null; has_draft: boolean };
type Week = {
  headline: Step;
  why_now: string | null;
  cost: string | null;
  after: string;
  before_paying: string[];
  also: Step[];
  packet: string[];
  ssn: { answer: string | null } | null;
  agency_list: string;
};

/** 6.6. One action, phrased as what she does this week. Why now, what it costs, what happens after. */
export default function WeekPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ header: Header; week: Week } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [changingSsn, setChangingSsn] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const load = useCallback(() => api<{ header: Header; week: Week }>(`/api/cases/${id}/position`).then(setData).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => { load(); }, [load]);
  if (!data) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const { header, week: w } = data;
  const lang = header.lang;

  const answerSsn = async (value: string) => {
    await api(`/api/cases/${id}/stated`, { method: "POST", json: { key: "has_ssn_or_itin", value } });
    setChangingSsn(false);
    load();
  };

  const draftLink = (s: Step) => t(lang, `draft.${s.kind}`);

  return (
    <Shell id={id} lang={lang} name={header.name} active="week" routeKind={header.route_kind} mock={header.mock}>
      {w.headline.kind === "upload_evaluation" ? (
        <section className="section first">
          <h1 style={{ marginTop: 0 }}>{w.headline.text}</h1>
          <Link className="btn" href={`/c/${id}/documents`}>{t(lang, "nav.documents")}</Link>
        </section>
      ) : (
        <section className="section first">
          <h1 style={{ marginTop: 0 }}>{w.headline.text}</h1>
          <p>{w.headline.why}</p>
          {w.why_now && <p><span className="label">{t(lang, "week.why_now")}</span>{w.why_now}</p>}
          {w.cost && <p><span className="label">{t(lang, "week.cost")}</span>{w.cost}</p>}
          <p><span className="label">{t(lang, "week.after")}</span>{w.after}</p>
          {w.before_paying.length > 0 && (
            <div style={{ padding: "8px 0", borderTop: "1px solid var(--rule)" }}>
              <p className="muted" style={{ marginBottom: 4 }}>{t(lang, "week.before_paying")}</p>
              {w.before_paying.map((b) => <p key={b} className="small">{b}</p>)}
            </div>
          )}
          {w.packet.length > 0 && (
            <div style={{ padding: "8px 0", borderTop: "1px solid var(--rule)" }}>
              <p className="muted" style={{ marginBottom: 4 }}>{t(lang, "week.packet")}</p>
              <ol className="small" style={{ margin: 0, paddingLeft: 22 }}>{w.packet.map((b) => <li key={b}>{b}</li>)}</ol>
            </div>
          )}
          <div className="row">
            {w.headline.has_draft && <Link className="btn" href={`/c/${id}/letter/${w.headline.kind}`}>{draftLink(w.headline)}</Link>}
            {w.headline.kind === "request_evaluation" && <a className="link sans" href={w.agency_list} target="_blank" rel="noreferrer">{t(lang, "week.agency_list")}</a>}
          </div>
        </section>
      )}

      {w.also.length > 0 && (
        <section className="section">
          <h2>{t(lang, "week.also")}</h2>
          {w.also.map((s) => (
            <div key={s.kind} className="item" style={{ display: "block" }}>
              <p style={{ marginBottom: 4 }}>{s.text}</p>
              <p className="small muted">{s.why}</p>
              {s.has_draft && <Link className="link sans" href={`/c/${id}/letter/${s.kind}`}>{draftLink(s)}</Link>}
            </div>
          ))}
        </section>
      )}

      {w.ssn && (
        <section className="section">
          {w.ssn.answer && !changingSsn ? (
            <p className="small">
              {t(lang, "week.ssn.saved", { answer: t(lang, `week.ssn.${w.ssn.answer}`) })}{" "}
              <button className="link sans" onClick={() => setChangingSsn(true)}>{t(lang, "week.ssn.change")}</button>
            </p>
          ) : (
            <>
              <p className="small">{t(lang, "week.ssn.q")} <button className="state" onClick={() => setWhy("R11")} aria-haspopup="dialog">{t(lang, "why.title")}</button></p>
              <div className="row sans" style={{ marginTop: 0 }}>
                {["yes", "no", "prefer_not"].map((v) => <button key={v} className="link" onClick={() => answerSsn(v)}>{t(lang, `week.ssn.${v}`)}</button>)}
              </div>
            </>
          )}
        </section>
      )}
      <WhyDrawer caseId={id} lang={lang} ruleId={why} onClose={() => setWhy(null)} />
    </Shell>
  );
}
