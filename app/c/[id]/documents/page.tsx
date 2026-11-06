"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorKey } from "@/components/api";
import { DocRead, type Doc } from "@/components/documents/DocRead";
import { FilePick } from "@/components/documents/FilePick";
import { RequestBlock } from "@/components/documents/RequestBlock";
import s from "@/components/documents/documents.module.css";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { exampleFor } from "@/data/document-examples";
import { joinList, t } from "@/lib/i18n";

type DocsResp = { documents: Doc[]; order: string[]; country: string | null; route_kind: string };

/** 6.3 as rebuilt in D22. One request at a time, with a reason and a picture; read documents below with the page beside the facts. */
export default function Documents() {
  const { id } = useParams<{ id: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [data, setData] = useState<DocsResp | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const skipKey = `earned.skip.${id}`;
  // After a document is read, bring her back up to the next request so the flow keeps moving.
  const requestRef = useRef<HTMLDivElement>(null);
  const toRequest = () => requestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
  const newest = [...read].reverse();

  const noun = (k: string) => t(lang, k === "license" && header.route_kind === "none" ? "noun.license_generic" : `noun.${k}`);
  const haveNouns = [...new Set(read.map((d) => d.kind).filter((k) => k !== "other"))].map(noun);

  const skip = (k: string) => {
    const next = [...skipped, k];
    setSkipped(next);
    localStorage.setItem(skipKey, JSON.stringify(next));
  };

  const upload = async (file: File, hint: string | null) => {
    setReading(true);
    setNote(null);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    if (hint) fd.append("kind_hint", hint);
    try {
      const r = await api<{ document: Doc; reclassified: boolean }>(`/api/cases/${id}/documents`, { method: "POST", body: fd });
      if (r.document.status !== "read") setErr("docs.unreadable");
      else if (r.reclassified) setNote(t(lang, "docs.reclassified", { noun: t(lang, `noun.${r.document.kind}`) }));
      else setNote(t(lang, "docs.got_it", { noun: noun(r.document.kind) }));
      await load();
      setTimeout(toRequest, 50);
    } catch (e) {
      setErr(errorKey(e) === "notconfigured" ? "notconfigured" : "docs.unreadable");
    } finally {
      setReading(false);
    }
  };

  return (
    <Shell id={id} lang={lang} name={header.name} active="documents" routeKind={header.route_kind} mock={header.mock}>
      <h1>{t(lang, "docs.title")}</h1>
      {haveNouns.length > 0 && <p className={`muted ${s.intro}`}>{t(lang, "docs.have", { list: joinList(lang, haveNouns) })}</p>}

      <div ref={requestRef} style={{ scrollMarginTop: 16 }}>
      <RequestBlock
        lang={lang}
        current={current}
        heading={current ? t(lang, isFirst ? "docs.first" : "docs.next", { noun: noun(current) }) : ""}
        example={current ? exampleFor(data.country, current) : null}
        reading={reading}
        note={note}
        err={err}
        continueHref={`/c/${id}/position`}
        onFile={(f) => current && upload(f, current)}
        onSkip={() => current && skip(current)}
      />
      </div>

      {read.length > 0 && <h2 className={s.listHead}>{t(lang, "docs.hydrated")}</h2>}
      {newest.map((d) => <DocRead key={d.id} doc={d} lang={lang} noun={noun(d.kind)} onChanged={load} />)}

      {read.length > 0 && current && !reading && (
        <p className="sans" style={{ marginTop: 20 }}><button type="button" className="link" onClick={toRequest}>{t(lang, "docs.next", { noun: noun(current) })}</button></p>
      )}

      <div className={`sans ${s.tail}`}>
        <FilePick label={t(lang, "docs.add_another")} onFile={(f) => upload(f, null)} />
        {skipped.length > 0 && <p className={`micro ${s.skipped}`}><span className="label">{t(lang, "docs.skipped")}</span>{joinList(lang, skipped.map(noun))}</p>}
      </div>
    </Shell>
  );
}
