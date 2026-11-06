"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header, Line } from "@/components/types";
import { WhyDrawer } from "@/components/WhyDrawer";
import { t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";

type Position = {
  doc_count: number;
  have: Line[];
  extra_have: { text: string; state_word: string; note: string | null; rule_id: string | null }[];
  needed: Line[];
  unknown: Line[];
  later: { rule_id: string; text: string }[];
  letter: { number: number; text: string; rule_id: string | null; paperwork: boolean; named: string[] }[];
  next: { kind: string; text: string };
};
type Resp = { header: Header; position: Position };

/** 6.4. What she already has first, then what is still needed, then what nobody can tell yet. No numbers. */
export default function PositionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Resp | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => api<Resp>(`/api/cases/${id}/position`).then(setData).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const { header, position: p } = data;
  const lang = header.lang;

  if (header.route_kind === "none") return <General id={id} header={header} p={p} />;

  const Row = ({ l }: { l: Line }) => (
    <div className="item">
      <span>{l.text}</span>
      <button className="state" onClick={() => setWhy(l.rule_id)} aria-haspopup="dialog">{l.state_word}</button>
    </div>
  );

  return (
    <Shell id={id} lang={lang} name={header.name} active="position" routeKind={header.route_kind} mock={header.mock}>
      <h1>{header.name ? t(lang, "position.header", { name: header.name }) : t(lang, "position.header_noname")}</h1>
      <p className="small muted">{t(lang, "position.ctc_intro")}</p>
      {header.route_kind === "near" && <p className="small">{t(lang, "position.near_note")}</p>}

      {p.letter.length > 0 && (
        <section className="section first">
          <h2>{t(lang, "position.letter_items")}</h2>
          {p.letter.map((it) => (
            <div key={it.number} className="item small" style={{ display: "block" }}>
              <div lang="en"><span className="muted">{it.number} · </span><span className="quote">“{it.text}”</span></div>
              {it.paperwork && (
                <div style={{ marginTop: 6 }}>
                  {t(lang, "position.letter_paperwork")}{" "}
                  {it.named.length > 0 && <span><span className="muted">{t(lang, "label.transcript.practicum_courses")} · </span>{it.named.map((n, i) => <span key={n}>{i > 0 && (i === it.named.length - 1 ? t(lang, "join.and") : ", ")}<span className="mark">{n}</span></span>)}</span>}{" "}
                  <button className="state" onClick={() => setWhy("R05")} aria-haspopup="dialog">{t(lang, "why.title")}</button>
                </div>
              )}
              {!it.rule_id && <div className="micro">{t(lang, "position.letter_unmatched")}</div>}
            </div>
          ))}
        </section>
      )}

      <section className={`section ${p.letter.length ? "" : "first"}`}>
        <h2>{t(lang, "position.have")}</h2>
        {p.doc_count === 0 && p.have.length === 0 ? <p className="muted">{t(lang, "position.nothing_yet")}</p> : null}
        {p.have.map((l) => <Row key={l.rule_id} l={l} />)}
        {p.extra_have.map((x) => (
          <div key={x.text} className="item">
            <span>{x.text}{x.note && <><br /><span className="small muted">{x.note}</span></>}</span>
            {x.rule_id ? <button className="state" onClick={() => setWhy(x.rule_id)} aria-haspopup="dialog">{x.state_word}</button> : <span className="sans">{x.state_word}</span>}
          </div>
        ))}
      </section>

      <section className="section">
        <h2>{t(lang, "position.needed")}</h2>
        {p.doc_count === 0 && <p className="small muted">{t(lang, "position.nothing_needed")}</p>}
        {p.needed.map((l) => <Row key={l.rule_id} l={l} />)}
      </section>

      {p.unknown.length > 0 && (
        <section className="section">
          <h2>{t(lang, "position.unknown")}</h2>
          {p.unknown.map((l) => <Row key={l.rule_id} l={l} />)}
        </section>
      )}

      <section className="section">
        <details>
          <summary><h2 style={{ display: "inline", margin: 0 }}>{t(lang, "position.later")} ({p.later.length})</h2></summary>
          <p className="small" style={{ marginTop: 8 }}>{t(lang, "position.later_note")}</p>
          {p.later.map((l) => (
            <div key={l.rule_id} className="item small"><span>{l.text}</span><button className="state" onClick={() => setWhy(l.rule_id)} aria-haspopup="dialog">{t(lang, "state.later")}</button></div>
          ))}
        </details>
      </section>

      <section className="section first" style={{ marginTop: 12 }}>
        <p className="micro" style={{ margin: 0 }}>{t(lang, "position.next")}</p>
        <p>{p.next.text}</p>
        <Link className="btn" href={`/c/${id}/week`}>{t(lang, "nav.week")}</Link>
      </section>

      <WhyDrawer caseId={id} lang={lang} ruleId={why} onClose={() => setWhy(null)} />
    </Shell>
  );
}

/** Any other profession or state: read the documents, name the office, write the first question. Never guess rules. */
function General({ id, header, p }: { id: string; header: Header; p: Position }) {
  const lang: Lang = header.lang;
  return (
    <Shell id={id} lang={lang} name={header.name} active="position" routeKind="none" mock={header.mock}>
      <h1>{header.name ? t(lang, "position.header", { name: header.name }) : t(lang, "position.header_noname")}</h1>
      <section className="section first">
        <h2>{t(lang, "office.title")}</h2>
        {header.office ? (
          <>
            <p>{header.office.name} · <a className="sans" href={header.office.url} target="_blank" rel="noreferrer">{t(lang, "office.open")}</a></p>
            {header.office.source === "search" && <p className="micro">{t(lang, "office.found_by_search")}</p>}
            {header.office.cited && <p className="small quote" lang="en">“{header.office.cited}”</p>}
          </>
        ) : (
          <p className="muted">{t(lang, "office.unknown_state")}</p>
        )}
        <p className="small">{header.general_orientation}</p>
      </section>
      <section className="section">
        <h2>{t(lang, "general.title")}</h2>
        <p className="small">{t(lang, "general.documents")}</p>
        {p.doc_count > 0 && <p className="small"><span className="muted">{t(lang, "docs.already")} · </span>{p.doc_count}</p>}
        <div className="row sans">
          <Link className="link" href={`/c/${id}/documents`}>{t(lang, "nav.documents")}</Link>
        </div>
      </section>
      <section className="section first">
        <p className="micro" style={{ margin: 0 }}>{t(lang, "office.question_title")}</p>
        <Link className="btn" href={`/c/${id}/letter/office_question`}>{t(lang, "week.see_letter")}</Link>
      </section>
    </Shell>
  );
}
