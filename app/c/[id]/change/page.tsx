"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { t } from "@/lib/i18n";

type Result = {
  scenario_id: string;
  changes: { rule_id: string; before: { text: string; state_word: string }; after: { text: string; state_word: string } }[];
  stays: { rule_id: string; text: string; state_word: string }[];
  notes: string[];
  summary: string;
  next: { was: string; now: string } | null;
};
type Commit = { committed: string[]; needs_upload: string[] };

const CONTROLS: { key: string; label: string; options: [string, string][] }[] = [
  { key: "report_type", label: "change.report", options: [["none", "change.report.none"], ["document_by_document", "change.report.document_by_document"], ["course_by_course", "change.report.course_by_course"]] },
  { key: "budget", label: "change.budget", options: [["under_300", "change.budget.under_300"], ["can_pay_evaluation", "change.budget.can_pay_evaluation"], ["whatever", "change.budget.whatever"]] },
  { key: "school_can_send_letter", label: "change.school", options: [["yes", "change.school.yes"], ["no", "change.school.no"], ["unknown", "change.school.unknown"]] },
  { key: "city", label: "change.city", options: [["San Jose", ""], ["Los Angeles", ""], ["outside", "change.city.outside"]] },
];

/** 6.9. Change one thing; see what changes and what stays. Nothing touches the real case unless she says it happened. */
export default function ChangePage() {
  const { id } = useParams<{ id: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [patch, setPatch] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [commit, setCommit] = useState<Commit | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => api<{ header: Header }>(`/api/cases/${id}`).then((r) => setHeader(r.header)).catch((e) => setErr(errorKey(e))), [id]);
  useEffect(() => { load(); }, [load]);
  if (!header) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const lang = header.lang;

  const show = async () => {
    setBusy(true);
    setCommit(null);
    try {
      setResult(await api<Result>(`/api/cases/${id}/scenarios`, { method: "POST", json: { patch } }));
    } catch (e) {
      setErr(errorKey(e));
    } finally {
      setBusy(false);
    }
  };
  const makeReal = async () => {
    if (!result) return;
    setCommit(await api<Commit>(`/api/scenarios/${result.scenario_id}/commit`, { method: "POST" }));
  };
  const set = (k: string, v: string) => {
    setPatch((p) => ({ ...p, [k]: v }));
    setResult(null);
    setCommit(null);
  };

  return (
    <Shell id={id} lang={lang} name={header.name} active="change" routeKind={header.route_kind} mock={header.mock}>
      <h1>{t(lang, "change.title")}</h1>
      <p className="small muted">{t(lang, "change.lead")}</p>

      <form onSubmit={(e) => { e.preventDefault(); show(); }}>
        {CONTROLS.map((c) => (
          <label key={c.key} className="control">
            <span>{t(lang, c.label)}</span>
            <select value={patch[c.key] ?? "as_is"} onChange={(e) => set(c.key, e.target.value)}>
              <option value="as_is">{t(lang, "change.as_is")}</option>
              {c.options.map(([v, k]) => <option key={v} value={v}>{k ? t(lang, k) : v}</option>)}
            </select>
          </label>
        ))}
        <label className="control">
          <span>{t(lang, "change.letter")}</span>
          <input type="date" value={patch.letter_date ?? ""} onChange={(e) => set("letter_date", e.target.value)} />
        </label>
        <div style={{ padding: "12px 0", borderTop: "1px solid var(--rule)" }}>
          <button className="btn" type="submit" disabled={busy}>{t(lang, "change.show")}</button>
        </div>
      </form>
      {err && <ErrorLine lang={lang} k={err} />}

      {result && (
        <section aria-live="polite">
          <div className="section first">
            <h2>{t(lang, "change.what_changes")}</h2>
            {result.changes.length === 0 && !result.next && result.notes.length === 0 && <p className="small muted">{t(lang, "change.summary.nothing")}</p>}
            {result.changes.map((c) => (
              <div key={c.rule_id} className="item" style={{ display: "block" }}>
                <div className="strike small">{c.before.text}, {c.before.state_word}</div>
                <div className="changed">{c.after.text}, <span className="sans">{c.after.state_word}</span></div>
              </div>
            ))}
            {result.next && (
              <div className="item" style={{ display: "block" }}>
                <div className="strike small"><span className="label">{t(lang, "change.next_was")}</span>{result.next.was}</div>
                <div className="changed"><span className="label">{t(lang, "change.next_now")}</span>{result.next.now}</div>
              </div>
            )}
            {result.notes.map((n) => <div key={n} className="item changed small">{n}</div>)}
          </div>
          <details className="section">
            <summary className="sans">{t(lang, "change.stays", { n: result.stays.length })}</summary>
            {result.stays.map((s) => <div key={s.rule_id} className="item small"><span>{s.text}</span><span className="sans muted">{s.state_word}</span></div>)}
          </details>
          <div className="section">
            <h2>{t(lang, "change.summary")}</h2>
            <p>{result.summary}</p>
          </div>
          <div className="section">
            {commit ? (
              <>
                {commit.committed.length > 0 && <p>{t(lang, "change.committed")}</p>}
                {commit.needs_upload.map((k) => <p key={k} className="small">{t(lang, `change.needs_upload.${k}`)}</p>)}
                {commit.needs_upload.length > 0 && <Link className="link sans" href={`/c/${id}/documents`}>{t(lang, "change.go_documents")}</Link>}
              </>
            ) : (
              <>
                <p>{t(lang, "change.real")}</p>
                <div className="row sans" style={{ marginTop: 0 }}>
                  <button className="link" onClick={makeReal}>{t(lang, "change.commit")}</button>
                  <button className="link muted" onClick={() => { setResult(null); setPatch({}); }}>{t(lang, "change.discard")}</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </Shell>
  );
}
