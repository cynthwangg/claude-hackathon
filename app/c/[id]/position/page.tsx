"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { LetterBlock, type LetterItem } from "@/components/position/LetterBlock";
import s from "@/components/position/position.module.css";
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
  letter: LetterItem[];
  transcript_document_id: string | null;
  next: { kind: string; text: string };
};
type Resp = { header: Header; position: Position };

function StateWord({ word, onClick }: { word: string; onClick: () => void }) {
  return <button className={`state ${s.quiet}`} onClick={onClick} aria-haspopup="dialog">{word}</button>;
}

function Row({ l, onWhy }: { l: Line; onWhy: (id: string) => void }) {
  return (
    <div className="item">
      <span>{l.text}</span>
      <StateWord word={l.state_word} onClick={() => onWhy(l.rule_id)} />
    </div>
  );
}

/** 6.4. What she already has first, then the letter, then what is still needed and what nobody can tell yet. No numbers. */
export default function PositionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Resp | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => api<Resp>(`/api/cases/${id}/position`).then(setData).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const { header, position: p } = data;
  const lang = header.lang;

  if (header.route_kind === "none") return <General id={id} header={header} p={p} />;

  const hasLetter = p.letter.length > 0;

  return (
    <Shell id={id} lang={lang} name={header.name} active="position" routeKind={header.route_kind} mock={header.mock}>
      <h1>{header.name ? t(lang, "position.header", { name: header.name }) : t(lang, "position.header_noname")}</h1>
      <p className="small muted">{t(lang, "position.ctc_intro")}</p>
      {header.route_kind === "near" && <p className="small">{t(lang, "position.near_note")}</p>}

      <section className="section">
        <h2>{t(lang, "position.have")}</h2>
        {p.doc_count === 0 && p.have.length === 0 ? <p className="muted">{t(lang, "position.nothing_yet")}</p> : null}
        {p.have.map((l) => <Row key={l.rule_id} l={l} onWhy={setWhy} />)}
        {p.extra_have.map((x) => (
          <div key={x.text} className="item">
            <span>{x.text}{x.note && <><br /><span className="small muted">{x.note}</span></>}</span>
            {x.rule_id ? <StateWord word={x.state_word} onClick={() => setWhy(x.rule_id)} /> : <span className={`state plain ${s.quiet}`}>{x.state_word}</span>}
          </div>
        ))}
      </section>

      {hasLetter && <LetterBlock lang={lang} items={p.letter} lines={[...p.needed, ...p.unknown, ...p.have]} transcriptId={p.transcript_document_id} onWhy={setWhy} />}

      <section className="section">
        <h2>{t(lang, "position.needed")}</h2>
        {p.doc_count === 0 && <p className="small muted">{t(lang, "position.nothing_needed")}</p>}
        {p.needed.map((l) => <Row key={l.rule_id} l={l} onWhy={setWhy} />)}
      </section>

      {p.unknown.length > 0 && (
        <section className="section">
          <h2>{t(lang, "position.unknown")}</h2>
          {p.unknown.map((l) => <Row key={l.rule_id} l={l} onWhy={setWhy} />)}
        </section>
      )}

      {p.later.length > 0 && (
        <section className="section">
          <div className={s.laterHead}>
            <h2>{t(lang, "position.later")} ({p.later.length})</h2>
            <button className={`link muted ${s.toggle}`} onClick={() => setLaterOpen((o) => !o)} aria-expanded={laterOpen} aria-controls="later-list">
              {t(lang, laterOpen ? "position.later_hide" : "position.later_show")}
            </button>
          </div>
          <div id="later-list" className={s.laterBody} hidden={!laterOpen}>
            <p className="small">{t(lang, "position.later_note")}</p>
            {p.later.map((l) => (
              <div key={l.rule_id} className="item small">
                <span>{l.text}</span>
                <StateWord word={t(lang, "state.later")} onClick={() => setWhy(l.rule_id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`section ${hasLetter ? "" : "first"}`} style={{ marginTop: 12 }}>
        <p className="micro">{t(lang, "position.next")}</p>
        <Link className="btn" href={`/c/${id}/week`}>{p.next.text}</Link>
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
            <p>{header.office.name}<br /><a className="sans" href={header.office.url} target="_blank" rel="noreferrer">{t(lang, "office.open")}</a></p>
            {header.office.source === "search" && <p className="micro">{t(lang, "office.found_by_search")}</p>}
            {header.office.cited && <p className="small quote" lang="en">“{header.office.cited}”</p>}
          </>
        ) : (
          <p className="muted">{t(lang, "office.unknown_state")}</p>
        )}
        <p className="small" style={{ whiteSpace: "pre-line" }}>{header.general_orientation}</p>
      </section>
      <section className="section">
        <h2>{t(lang, "general.title")}</h2>
        <p className="small">{t(lang, "general.documents")}</p>
        {p.doc_count > 0 && <p className="small"><span className="label">{t(lang, "docs.already")}</span>{p.doc_count}</p>}
        <div className="row sans">
          <Link className="link" href={`/c/${id}/documents`}>{t(lang, "nav.documents")}</Link>
        </div>
      </section>
      <section className="section">
        <p className="micro">{t(lang, "office.question_title")}</p>
        <Link className="btn" href={`/c/${id}/letter/office_question`}>{t(lang, "week.see_letter")}</Link>
      </section>
    </Shell>
  );
}
