"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { t } from "@/lib/i18n";

type Draft = { kind: "school" | "agency" | "ctc" | "office"; language: string; subject: string; body: string; to?: string; aid: string | null; aid_label: string | null };

const TITLE: Record<string, string> = { school: "letter.title_school", agency: "letter.title_agency", ctc: "letter.title_ctc", office: "office.question_title" };

/** 6.7. The letter in the recipient's language, her translation beside it only when it differs (F8). Nothing is sent. */
export default function LetterPage() {
  const { id, kind } = useParams<{ id: string; kind: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const store = `earned.letter.${id}.${kind}`;

  const load = useCallback(async () => {
    try {
      const h = await api<{ header: Header }>(`/api/cases/${id}`);
      setHeader(h.header);
      const d = await api<Draft>(`/api/cases/${id}/drafts/${kind}`, { method: "POST" });
      setDraft(d);
      setBody(localStorage.getItem(store) ?? d.body);
    } catch (e) {
      setErr(errorKey(e));
    }
  }, [id, kind, store]);
  useEffect(() => { load(); }, [load]);

  if (!header) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const lang = header.lang;
  if (!draft) return <Shell id={id} lang={lang} name={header.name} routeKind={header.route_kind} mock={header.mock}>{err ? <ErrorLine lang={lang} k="letter.failed" /> : <p className="muted" style={{ marginTop: 24 }}>{t(lang, "letter.preparing")}</p>}</Shell>;

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const mail = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Shell id={id} lang={lang} name={header.name} routeKind={header.route_kind} mock={header.mock} wide>
      <h1 className="noprint">{t(lang, TITLE[draft.kind])}</h1>
      {draft.to && <p className="small noprint"><span className="muted">{draft.to}</span></p>}
      {body.includes("[") && <p className="small noprint">{t(lang, "letter.fill")}</p>}
      <div className="lettergrid">
        <div>
          <label className="sr" htmlFor="letter">{draft.subject}</label>
          <textarea id="letter" className="letter noprint" lang={draft.language} value={body} onChange={(e) => { setBody(e.target.value); localStorage.setItem(store, e.target.value); }} style={{ minHeight: 420 }} />
          <div className="letter print-only" lang={draft.language} aria-hidden="true" style={{ display: "none" }}>{body}</div>
        </div>
        {draft.aid && (
          <div className="noprint">
            <p className="micro">{t(lang, draft.aid_label ?? "letter.aid_same")}</p>
            <div className="letter small" lang={lang} style={{ background: "transparent" }}>{draft.aid}</div>
          </div>
        )}
      </div>
      <div className="row sans noprint">
        <button className="link" onClick={copy}>{copied ? t(lang, "letter.copied") : t(lang, "letter.copy")}</button>
        <button className="link" onClick={() => window.print()}>{t(lang, "letter.print")}</button>
        <a className="link" href={mail}>{t(lang, "letter.email")}</a>
      </div>
      <p className="micro noprint" style={{ marginTop: 12 }}>{t(lang, "letter.nothing_sent")}</p>
    </Shell>
  );
}
