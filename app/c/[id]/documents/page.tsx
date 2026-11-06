"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { exampleFor } from "@/data/document-examples";
import { fmtDate, has, t } from "@/lib/i18n";
import { containsAny } from "@/lib/norm";
import { PRACTICUM_SYNONYMS } from "@/rules/ctc-ms-foreign";
import type { Lang } from "@/rules/types";

type Fact = { id: string; key: string; value: unknown; original_text: string | null; page: number | null; corrected: boolean };
type Doc = { id: string; kind: string; status: string; reading_aid: string | null; injection: boolean; confirmed: boolean; preview: string; original: string; facts: Fact[] };
type DocsResp = { documents: Doc[]; order: string[]; country: string | null; route_kind: string };

const HIDDEN = /\.present$|^transcript\.courses$|^evaluation\.lists_courses$/;
const READ_ONLY = ["ctc_letter.deadline_days", "ctc_letter.items", "ctc_letter.must_attach_letter", "transcript.course_names", "evaluation.documents_reviewed"];

/** 6.3 as rebuilt in D22. One request at a time, with a reason and a picture; read documents below with the page beside the facts. */
export default function Documents() {
  const { id } = useParams<{ id: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [data, setData] = useState<DocsResp | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const skipKey = `earned.skip.${id}`;

  const load = useCallback(async () => {
    try {
      const [h, d] = await Promise.all([api<{ header: Header }>(`/api/cases/${id}`), api<DocsResp>(`/api/cases/${id}/documents`)]);
      setHeader(h.header);
      setData(d);
    } catch (e) {
      setErr(errorKey(e));
    }
  }, [id]);

  useEffect(() => {
    load();
    try { setSkipped(JSON.parse(localStorage.getItem(skipKey) ?? "[]")); } catch { setSkipped([]); }
  }, [load, skipKey]);

  if (!header || !data) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const lang = header.lang;
  const read = data.documents.filter((d) => d.status === "read");
  const haveKinds = new Set(read.map((d) => (d.kind === "practicum_record" ? "experience" : d.kind)));
  const remaining = data.order.filter((k) => !haveKinds.has(k) && !skipped.includes(k));
  const current = remaining[0] ?? null;
  const isFirst = read.length === 0 && skipped.length === 0;

  const skip = (k: string) => {
    const next = [...skipped, k];
    setSkipped(next);
    localStorage.setItem(skipKey, JSON.stringify(next));
  };

  const upload = async (file: File, hint: string | null) => {
    setReading(hint ?? "other");
    setNote(null);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    if (hint) fd.append("kind_hint", hint);
    try {
      const r = await api<{ document: Doc; reclassified: boolean }>(`/api/cases/${id}/documents`, { method: "POST", body: fd });
      if (r.document.status !== "read") setErr("docs.unreadable");
      else if (r.reclassified) setNote(t(lang, "docs.reclassified", { noun: t(lang, `noun.${r.document.kind}`) }));
      await load();
    } catch (e) {
      setErr(errorKey(e) === "notconfigured" ? "notconfigured" : "docs.unreadable");
    } finally {
      setReading(null);
    }
  };

  const noun = (k: string) => t(lang, k === "license" && header.route_kind === "none" ? "noun.license_generic" : `noun.${k}`);
  const ex = current ? exampleFor(data.country, current) : null;

  return (
    <Shell id={id} lang={lang} name={header.name} active="documents" routeKind={header.route_kind} mock={header.mock} wide>
      {read.length > 0 && <p className="muted" style={{ marginTop: 20 }}>{t(lang, "docs.hydrated")}</p>}

      {current ? (
        <section className="ask" aria-live="polite">
          <h2>{t(lang, isFirst ? "docs.first" : "docs.next", { noun: noun(current) })}</h2>
          <div className="askgrid">
            {ex ? <img className="example" src={ex} alt="" /> : <span />}
            <div className="small">
              {has(lang, `ask.${current}.looks`) && <p><span className="muted">{t(lang, "docs.looks_like")} · </span>{t(lang, `ask.${current}.looks`)}</p>}
              {has(lang, `ask.${current}.for`) && <p><span className="muted">{t(lang, "docs.looking_for")} · </span>{t(lang, `ask.${current}.for`)}</p>}
              {reading ? (
                <p className="muted" role="status">{t(lang, "docs.reading")}</p>
              ) : (
                <div className="sans row" style={{ gap: 18 }}>
                  <label className="link">
                    {t(lang, "docs.choose")}
                    <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, current); }} />
                  </label>
                  <button className="link muted" onClick={() => skip(current)}>{t(lang, "docs.skip")}</button>
                </div>
              )}
              {note && <p className="small">{note}</p>}
              {err && <ErrorLine lang={lang} k={err} />}
            </div>
          </div>
        </section>
      ) : (
        <section className="ask"><p className="small">{t(lang, "docs.none_left")}</p>{reading && <p className="muted" role="status">{t(lang, "docs.reading")}</p>}{err && <ErrorLine lang={lang} k={err} />}</section>
      )}

      <div style={{ margin: "20px 0" }}>
        <Link className="btn" href={`/c/${id}/position`}>{t(lang, "docs.continue")}</Link>
      </div>

      {read.length > 0 && <h2>{t(lang, "docs.already")}</h2>}
      {[...read].reverse().map((d) => <DocRead key={d.id} doc={d} lang={lang} noun={noun(d.kind)} onChanged={load} />)}

      <div className="sans" style={{ padding: "14px 0", borderTop: "1px solid var(--rule)" }}>
        <label className="link">
          {t(lang, "docs.add_another")}
          <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, null); }} />
        </label>
        {skipped.length > 0 && <span className="micro"> · {t(lang, "docs.skipped")} {skipped.map(noun).join(", ")}</span>}
      </div>
    </Shell>
  );
}

function display(lang: Lang, key: string, v: unknown): string {
  if (typeof v === "boolean") return t(lang, `value.${v}`);
  if (key === "evaluation.report_type" && typeof v === "string") return t(lang, `value.${v}`);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x && "text" in x ? `${(x as { number: number }).number}. ${(x as { text: string }).text}` : String(x))).join(key === "ctc_letter.items" ? "\n" : ", ");
  if (typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(v)) return fmtDate(lang, v);
  return String(v ?? "");
}

function DocRead({ doc, lang, noun, onChanged }: { doc: Doc; lang: Lang; noun: string; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState(doc.confirmed);
  const facts = doc.facts.filter((f) => !HIDDEN.test(f.key));
  const courses = doc.facts.find((f) => f.key === "transcript.course_names")?.value as string[] | undefined;
  const practicum = courses?.filter((c) => containsAny(c, PRACTICUM_SYNONYMS)) ?? [];

  const save = async (f: Fact) => {
    await api(`/api/facts/${f.id}`, { method: "PATCH", json: { value } });
    setEditing(null);
    onChanged();
  };
  const confirm = async () => {
    await api(`/api/documents/${doc.id}/confirm`, { method: "POST" });
    setConfirmed(true);
  };

  return (
    <div className="docgrid">
      <div className="doc">
        <img src={doc.preview} alt={noun} />
        <p className="micro" style={{ marginTop: 6 }}><a href={doc.original} target="_blank" rel="noreferrer">{t(lang, "docs.open_original")}</a></p>
      </div>
      <div className="small">
        <p>{t(lang, "docs.header", { noun })}</p>
        {doc.injection && <p className="micro">{t(lang, "docs.injection")}</p>}
        {doc.reading_aid && (
          <div style={{ padding: "8px 0", borderTop: "1px solid var(--rule)" }}>
            <p className="micro">{t(lang, "docs.reading_aid")}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{doc.reading_aid}</p>
          </div>
        )}
        {facts.map((f) => {
          const label = f.key.includes(".extra.") ? t(lang, "label.extra") : t(lang, `label.${f.key}`);
          const isCourses = f.key === "transcript.course_names";
          return (
            <div key={f.id} style={{ padding: "6px 0", borderTop: "1px solid var(--rule)" }}>
              {isCourses ? (
                <>
                  <div><span className="muted">{label} · </span>{courses?.length ?? 0}</div>
                  {practicum.length > 0 && <div><span className="muted">{t(lang, "label.transcript.practicum_courses")} · </span>{practicum.map((c, i) => <span key={c}>{i > 0 && ", "}<span className="mark">{c}</span></span>)}</div>}
                </>
              ) : editing === f.id ? (
                <form className="row" style={{ marginTop: 0 }} onSubmit={(e) => { e.preventDefault(); save(f); }}>
                  <label className="sr" htmlFor={`fix-${f.id}`}>{label}</label>
                  <input id={`fix-${f.id}`} type="text" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
                  <button className="link sans" type="submit">{t(lang, "docs.save")}</button>
                </form>
              ) : (
                <div style={{ whiteSpace: f.key === "ctc_letter.items" ? "pre-wrap" : undefined }}><span className="muted">{label} · </span>{display(lang, f.key, f.value)}</div>
              )}
              {f.original_text && !isCourses && f.key !== "ctc_letter.items" && (
                <div className="quote">“{f.original_text}”{f.page ? ` · ${lang === "es" ? "página" : lang === "zh" ? "第" : "page"} ${f.page}${lang === "zh" ? " 页" : ""}` : ""}</div>
              )}
              {f.key === "ctc_letter.deadline_days" && <div className="micro">{t(lang, "docs.letter_deadline_note")}</div>}
              {!READ_ONLY.includes(f.key) && editing !== f.id && (
                <div className="sans"><button className="link muted" onClick={() => { setEditing(f.id); setValue(typeof f.value === "string" ? f.value : display(lang, f.key, f.value)); }}>{t(lang, "docs.fix")}</button></div>
              )}
            </div>
          );
        })}
        <div className="sans" style={{ paddingTop: 8 }}>
          {confirmed ? <span className="micro">{t(lang, "docs.confirmed")}</span> : <button className="link" onClick={confirm}>{t(lang, "docs.all_good")}</button>}
        </div>
      </div>
    </div>
  );
}
