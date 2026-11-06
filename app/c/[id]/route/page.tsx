"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { WhyDrawer } from "@/components/WhyDrawer";
import { t } from "@/lib/i18n";

type Route = {
  title: string;
  steps: { key: string; rule_id: string; text: string; state: string; state_word: string; note: string | null }[];
  known: { rule_id: string; text: string; amount: string; paid: boolean }[];
  paid_note: string | null;
  external: { rule_id: string; text: string }[];
  bridge: boolean;
  blocker: { rule_id: string; text: string } | null;
};

/** 6.5. One route, who decides, known costs only from CL-659, the bridge in one line. */
export default function RoutePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ header: Header; route: Route } | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<{ header: Header; route: Route }>(`/api/cases/${id}/position`).then(setData).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => { load(); }, [load]);
  if (!data) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const { header, route: r } = data;
  const lang = header.lang;
  return (
    <Shell id={id} lang={lang} name={header.name} active="route" routeKind={header.route_kind} mock={header.mock}>
      <h1>{r.title}</h1>
      <p className="small muted">{t(lang, "route.decides")}</p>

      {r.blocker && (
        <section className="section first">
          <p>{t(lang, "route.blocker")}</p>
          <div className="item"><span>{r.blocker.text}</span><button className="state" onClick={() => setWhy(r.blocker!.rule_id)} aria-haspopup="dialog">{t(lang, "state.missing")}</button></div>
        </section>
      )}

      <section className={`section ${r.blocker ? "" : "first"}`}>
        <ol className="steps">
          {r.steps.filter((s) => s.key !== "route.step.ctc_reviews").map((s) => (
            <li key={s.key}>
              <div className="item">
                <span>{s.text}{s.note && <span className="small muted" style={{ display: "block" }}>{s.note}</span>}</span>
                <button className="state" onClick={() => setWhy(s.rule_id)} aria-haspopup="dialog">{s.state_word}</button>
              </div>
            </li>
          ))}
          <li>
            <div className="item">
              <span>{t(lang, "route.step.ctc_reviews")}<br /><span className="small muted">{t(lang, "route.timing")}</span></span>
              <button className="state" onClick={() => setWhy("P01")} aria-haspopup="dialog">{t(lang, "route.state.waiting")}</button>
            </div>
          </li>
        </ol>
      </section>

      <section className="section">
        <h2>{t(lang, "route.known")}</h2>
        {r.known.map((k) => (
          <div key={k.text} className="item small"><span>{k.text}, {k.amount}</span><button className="cite" onClick={() => setWhy(k.rule_id)} aria-label={`${t(lang, "route.source")} CL-659`}>CL-659</button></div>
        ))}
        {r.paid_note && <p className="small" style={{ marginTop: 8 }}>{r.paid_note}</p>}
        <h2 style={{ marginTop: 24 }}>{t(lang, "route.external")}</h2>
        {r.external.map((k) => <div key={k.text} className="item small"><span>{k.text}</span></div>)}
      </section>

      {r.bridge && (
        <section className="section">
          <h2>{t(lang, "route.bridge_title")}</h2>
          <p className="small">{t(lang, "route.bridge")}</p>
          <button className="cite" onClick={() => setWhy("B01")} aria-haspopup="dialog">CL-635</button>
        </section>
      )}
      <WhyDrawer caseId={id} lang={lang} ruleId={why} onClose={() => setWhy(null)} />
    </Shell>
  );
}
