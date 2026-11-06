"use client";

import { useState } from "react";
import { api } from "@/components/api";
import { fmtDate, t } from "@/lib/i18n";
import { containsAny } from "@/lib/norm";
import { PRACTICUM_SYNONYMS } from "@/rules/ctc-ms-foreign";
import type { Lang } from "@/rules/types";
import s from "./documents.module.css";

export type Fact = { id: string; key: string; value: unknown; original_text: string | null; page: number | null; corrected: boolean };
export type Doc = { id: string; kind: string; status: string; language: string | null; reading_aid: string | null; injection: boolean; confirmed: boolean; preview: string; original: string; facts: Fact[] };

const HIDDEN = /\.present$|^transcript\.courses$|^evaluation\.lists_courses$/;
const READ_ONLY = ["ctc_letter.deadline_days", "ctc_letter.items", "ctc_letter.must_attach_letter", "transcript.course_names", "evaluation.documents_reviewed"];
const REPORT_TYPES = ["course_by_course", "document_by_document", "other"];
const AID_LABEL = /^\s*(unofficial reading aid|traducción de apoyo|辅助翻译)[^\n]*\n+/i;

function display(lang: Lang, key: string, v: unknown): string {
  if (typeof v === "boolean") return t(lang, `value.${v}`);
  if (key === "evaluation.report_type" && typeof v === "string") return t(lang, `value.${v}`);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x && "text" in x ? `${(x as { number: number }).number}. ${(x as { text: string }).text}` : String(x))).join(key === "ctc_letter.items" ? "\n" : ", ");
  if (typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(v)) return fmtDate(lang, v);
  return String(v ?? "");
}

function prefill(lang: Lang, f: Fact): string {
  if (typeof f.value === "boolean" || typeof f.value === "number") return String(f.value);
  if (typeof f.value === "string") return f.value;
  if (Array.isArray(f.value) && f.value.every((x) => typeof x === "string")) return f.value.join(", ");
  return display(lang, f.key, f.value);
}

function parseBack(f: Fact, input: string): unknown {
  if (typeof f.value === "boolean") return input === "true";
  if (typeof f.value === "number") return Number.isFinite(Number(input)) && input.trim() !== "" ? Number(input) : input;
  if (Array.isArray(f.value) && f.value.every((x) => typeof x === "string")) return input.split(",").map((x) => x.trim()).filter(Boolean);
  return input.trim();
}

/** Extra lines arrive as "Label · value" from the reader. */
function splitExtra(v: unknown): [string, string] {
  const str = String(v ?? "");
  const i = str.indexOf(" · ");
  return i > 0 ? [str.slice(0, i), str.slice(i + 3)] : ["", str];
}

/** Letters and digits only, so "RE: Returned for Additional Information" and "Returned for Additional Information" compare equal enough. */
const bare = (x: string) => x.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

/** The quote only shows when it adds something, not when it repeats the value word for word. */
function Quote({ f, lang, docLang, shown }: { f: Fact; lang: Lang; docLang: string | null; shown: string }) {
  if (!f.original_text) return null;
  const q = bare(f.original_text), v = bare(shown);
  if (v && (q === v || ((q.includes(v) || v.includes(q)) && Math.abs(q.length - v.length) <= 12))) return null;
  return (
    <div className={`quote ${s.quote}`}>
      <span lang={docLang ?? undefined}>“{f.original_text}”</span>
      {f.page ? `, ${t(lang, "docs.page", { n: f.page })}` : ""}
    </div>
  );
}

function FactRow({ f, lang, docLang, editing, onChanged }: { f: Fact; lang: Lang; docLang: string | null; editing: boolean; onChanged: () => void }) {
  const [value, setValue] = useState(() => prefill(lang, f));
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const extra = f.key.includes(".extra.");
  const [extraLabel, extraValue] = extra ? splitExtra(f.value) : ["", ""];
  const label = extra ? extraLabel || t(lang, "label.extra") : t(lang, `label.${f.key}`);
  const shown = extra ? extraValue : display(lang, f.key, f.value);
  const editable = editing && !READ_ONLY.includes(f.key);
  const inputId = `fix-${f.id}`;

  const save = async () => {
    setFailed(false);
    try {
      await api(`/api/facts/${f.id}`, { method: "PATCH", json: { value: parseBack(f, value) } });
      setSaved(true);
      onChanged();
    } catch {
      setFailed(true);
    }
  };
  const change = (v: string) => { setValue(v); setSaved(false); };

  const choices = typeof f.value === "boolean" ? ["true", "false"] : f.key === "evaluation.report_type" ? REPORT_TYPES : null;

  return (
    <div className={s.fact}>
      {editable ? (
        <>
          <label className="muted" htmlFor={inputId}>{label}</label>
          <form className={s.edit} onSubmit={(e) => { e.preventDefault(); save(); }}>
            {choices ? (
              <select id={inputId} className={s.field} value={value} onChange={(e) => change(e.target.value)}>
                {choices.map((c) => <option key={c} value={c}>{t(lang, `value.${c}`)}</option>)}
              </select>
            ) : (
              <input id={inputId} className={s.field} type="text" value={value} onChange={(e) => change(e.target.value)} />
            )}
            <button className="link sans" type="submit">{t(lang, "docs.save")}</button>
            {saved && <span className="micro" role="status">{t(lang, "docs.saved")}</span>}
          </form>
          {failed && <p className={`micro ${s.failed}`} role="alert">{t(lang, "docs.save_failed")}</p>}
        </>
      ) : (
        <div className={f.key === "ctc_letter.items" ? s.pre : undefined}><span className="label">{label}</span>{shown}</div>
      )}
      {f.key !== "ctc_letter.items" && <Quote f={f} lang={lang} docLang={docLang} shown={shown} />}
      {f.key === "ctc_letter.deadline_days" && <div className="micro">{t(lang, "docs.letter_deadline_note")}</div>}
    </div>
  );
}

/** One read document. The page on the left, what was read beside it, one confirmation, one way to correct. */
export function DocRead({ doc, lang, noun, onChanged }: { doc: Doc; lang: Lang; noun: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [confirmed, setConfirmed] = useState(doc.confirmed);

  const visible = doc.facts.filter((f) => !HIDDEN.test(f.key));
  const coursesFact = visible.find((f) => f.key === "transcript.course_names");
  const courses = Array.isArray(coursesFact?.value) ? (coursesFact.value as unknown[]).map(String) : null;
  const practicum = courses?.filter((c) => containsAny(c, PRACTICUM_SYNONYMS)) ?? [];
  const main = visible.filter((f) => f !== coursesFact && !f.key.includes(".extra."));
  const extras = visible.filter((f) => f.key.includes(".extra."));
  const aid = doc.reading_aid?.replace(AID_LABEL, "").trim() ?? "";

  const confirm = async () => {
    await api(`/api/documents/${doc.id}/confirm`, { method: "POST" });
    setConfirmed(true);
  };

  const row = (f: Fact) => <FactRow key={f.id} f={f} lang={lang} docLang={doc.language} editing={editing} onChanged={onChanged} />;

  return (
    <article className={s.doc}>
      <div className={`doc ${s.page}`}>
        <img src={doc.preview} alt={noun} />
        <p className="micro"><a href={doc.original} target="_blank" rel="noreferrer">{t(lang, "docs.open_original")}</a></p>
      </div>

      <div className="small">
        <p className={s.lead}>{t(lang, "docs.header", { noun })}</p>
        {doc.injection && <p className="micro">{t(lang, "docs.injection")}</p>}

        {aid && (
          <div className={s.aid}>
            <p className="micro">{t(lang, "docs.reading_aid")}</p>
            <p className={s.aidText}>{aid}</p>
          </div>
        )}

        {courses && (
          <div className={s.courses}>
            <p><span className="label">{t(lang, "label.transcript.course_names")}</span>{courses.length}</p>
            {practicum.length > 0 && (
              <>
                <p className={`muted ${s.courseLabel}`}>{t(lang, "label.transcript.practicum_courses")}</p>
                <ul className={s.courseList}>
                  {practicum.map((c) => <li key={c}><span className="mark">{c}</span></li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {main.map(row)}

        {extras.length > 0 && (
          <>
            {(showExtra || editing) && extras.map(row)}
            {!editing && (
              <div className={`sans ${s.more}`}>
                <button type="button" className="link muted" aria-expanded={showExtra} onClick={() => setShowExtra(!showExtra)}>
                  {t(lang, showExtra ? "docs.extra_hide" : "docs.extra_show")}
                </button>
              </div>
            )}
          </>
        )}

        <div className={`sans ${s.footer}`}>
          {confirmed && !editing ? (
            <span className="micro">{t(lang, "docs.confirmed")}</span>
          ) : (
            !editing && <button type="button" className="link" onClick={confirm}>{t(lang, "docs.all_good")}</button>
          )}
          <button type="button" className="link muted" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            {t(lang, editing ? "docs.done_fixing" : "docs.something_wrong")}
          </button>
        </div>
      </div>
    </article>
  );
}
