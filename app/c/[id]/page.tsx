"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading } from "@/components/Shell";
import type { Header } from "@/components/types";
import { useDictation } from "@/components/useDictation";
import { t } from "@/lib/i18n";
import type { Intake, Turn } from "@/lib/intake/types";
import type { Lang } from "@/rules/types";
import s from "./opener.module.css";

type CaseResp = { header: Header; intake: Intake; history: Turn[]; done: boolean };
type MsgResp = { say: string | null; intake: Intake; done: boolean; language: Lang; header: Header | null };

/** 6.2 as rebuilt in D19. One open opener; the model asks only for what is missing; code decides when it is done. */
export default function Opener() {
  const { id } = useParams<{ id: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [done, setDone] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api<CaseResp>(`/api/cases/${id}`)
      .then((r) => {
        setHeader(r.header);
        setLang(r.header.lang);
        setTurns(r.history);
        setIntake(r.intake);
        setDone(r.done);
      })
      .catch((e) => setErr(errorKey(e)));
  }, [id]);

  const dict = useDictation(lang, (v) => setText(v));

  useEffect(() => {
    form.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length, done]);

  const send = useCallback(
    async (message: string) => {
      const m = message.trim();
      if (!m || busy) return;
      setBusy(true);
      setErr(null);
      setTurns((ts) => [...ts, { role: "user", text: m }]);
      try {
        const r = await api<MsgResp>(`/api/cases/${id}/messages`, { method: "POST", json: { text: m } });
        setText("");
        setIntake(r.intake);
        setLang(r.language);
        if (r.say) setTurns((ts) => [...ts, { role: "assistant", text: r.say! }]);
        if (r.done) {
          setDone(true);
          if (r.header) setHeader(r.header);
          setTimeout(() => heading.current?.focus(), 0);
        }
      } catch (e) {
        setTurns((ts) => ts.slice(0, -1));
        setErr(errorKey(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, id],
  );

  if (!header) return err ? <main className="wrap"><ErrorLine lang={lang} k={err} /></main> : <Loading lang={lang} />;

  const examples: [string, string][] = lang === "zh" ? [["opener.ex_lin", "opener.ex_lin_text"]] : [["opener.ex_mariana", "opener.ex_mariana_text"], ["opener.ex_lin", "opener.ex_lin_text"], ["opener.ex_nurse", "opener.ex_nurse_text"]];
  const summary = done && intake !== null;
  const hasText = text.trim().length > 0;

  return (
    <main className="wrap" lang={lang}>
      {header.mock && <p className="micro" style={{ marginTop: 12 }}>{t(lang, "mock.note")}</p>}
      <h1 ref={heading} tabIndex={-1} className={s.heading}>{t(lang, summary ? "opener.understood" : "opener.title")}</h1>
      {turns.length === 0 && <p className="muted">{t(lang, "opener.lead")}</p>}

      <div aria-live="polite">
        {turns.map((tu, i) => (
          <p key={i} className={tu.role === "user" ? `turn ${s.her}` : "turn"}>{tu.text}</p>
        ))}
        {busy && <p className="muted">{t(lang, "opener.reading")}</p>}
      </div>

      {summary && intake ? (
        <Summary lang={lang} intake={intake} header={header} id={id} onChange={() => { setDone(false); setTimeout(() => field.current?.focus(), 0); }} />
      ) : (
        <form ref={form} className={s.form} onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <label className="sr" htmlFor="opener">{t(lang, "opener.title")}</label>
          <textarea
            id="opener"
            ref={field}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={turns.length ? "" : t(lang, "opener.placeholder")}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send(text);
              }
            }}
          />
          <div className={s.actions}>
            {hasText && !busy && <button className="btn" type="submit">{t(lang, turns.length ? "opener.add" : "opener.send")}</button>}
            {dict.supported && (
              <button type="button" className={`link ${s.speak}`} onClick={dict.toggle} aria-pressed={dict.listening} disabled={busy}>
                {dict.listening ? t(lang, "opener.listening") : t(lang, "opener.speak")}
              </button>
            )}
          </div>
          <p className="micro" style={{ marginTop: 4 }}>{dict.supported ? t(lang, "opener.hint") : t(lang, "opener.type_hint")}</p>
          {turns.length === 0 && (
            <div className={s.examples}>
              <p className="micro" style={{ margin: 0 }}>{t(lang, "opener.examples")}</p>
              <ul>
                {examples.map(([label, body]) => (
                  <li key={label}>
                    <button type="button" className={`link muted ${s.example}`} onClick={() => send(t(lang, body))}>{t(lang, label)}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}
      {err && <ErrorLine lang={lang} k={err} />}
    </main>
  );
}

/** "Commission on Teacher Credentialing (CTC)" becomes "The Commission on Teacher Credentialing, the CTC". */
function officeName(lang: Lang, name: string) {
  const m = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  return m ? t(lang, "office.name_short", { name: m[1], short: m[2] }) : name;
}

function Summary({ lang, intake, header, id, onChange }: { lang: Lang; intake: Intake; header: Header; id: string; onChange: () => void }) {
  const profession = [intake.profession ? t(lang, `profession.${intake.profession}`) : intake.profession_words, intake.level && intake.level !== "not_applicable" ? t(lang, `level.${intake.level}`) : null].filter(Boolean).join(", ");
  const lines: [string, string][] = [
    [t(lang, "intake.profession"), profession],
    [t(lang, "intake.country"), intake.country_of_training ?? ""],
    [t(lang, "intake.state"), [intake.city, intake.us_state].filter(Boolean).join(", ")],
    [t(lang, "intake.license"), intake.has_foreign_license ? t(lang, "intake.yes") : t(lang, "intake.no")],
    [t(lang, "intake.stage"), intake.stage ? t(lang, `stage.${intake.stage}`) : ""],
  ];
  const orientation = header.pathway?.orientation ?? header.general_orientation;
  return (
    <section className={s.summary}>
      {lines.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="item small"><span><span className="label">{k}</span>{v}</span></div>
      ))}
      {intake.stage === "about_to_pay_agency" && <p className="small" style={{ marginTop: 8 }}>{t(lang, "stage.preflight")}</p>}
      <div className={`sans ${s.change}`}><button type="button" className="link muted" onClick={onChange}>{t(lang, "opener.change")}</button></div>

      <section className={`section first ${s.office}`} aria-labelledby="office-title">
        <p id="office-title" className="micro" style={{ margin: 0 }}>{t(lang, "office.title")}</p>
        {header.office ? (
          <>
            <h2>{officeName(lang, header.office.name)}</h2>
            <p className="sans" style={{ margin: 0 }}><a href={header.office.url} target="_blank" rel="noreferrer">{t(lang, "office.open")}</a></p>
            {header.office.source === "search" && <p className="micro" style={{ marginTop: 6 }}>{t(lang, "office.found_by_search")}</p>}
          </>
        ) : (
          <p className="muted" style={{ marginTop: 6 }}>{t(lang, "office.unknown_state")}</p>
        )}
        <p className={`small muted ${s.orientation}`}>{orientation}</p>
      </section>
      <div className={s.next}>
        <Link className="btn" href={`/c/${id}/documents`}>{t(lang, "opener.continue")}</Link>
      </div>
    </section>
  );
}
