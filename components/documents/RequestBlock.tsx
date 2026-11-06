"use client";

import Link from "next/link";
import { ErrorLine } from "@/components/Shell";
import { has, t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";
import { FilePick } from "./FilePick";
import s from "./documents.module.css";

type Props = {
  lang: Lang;
  current: string | null;
  heading: string;
  example: string | null;
  reading: boolean;
  note: string | null;
  err: string | null;
  continueHref: string;
  onFile: (f: File) => void;
  onSkip: () => void;
};

/** The one current request, under the ink rule. Choosing the file is her action; where she stands is a quiet link. */
export function RequestBlock({ lang, current, heading, example, reading, note, err, continueHref, onFile, onSkip }: Props) {
  const status = (
    <>
      {reading && <p className="muted small" role="status">{t(lang, "docs.reading")}</p>}
      {note && <p className="small">{note}</p>}
      {err && <ErrorLine lang={lang} k={err} />}
    </>
  );

  if (!current) {
    return (
      <section className="ask" aria-live="polite">
        <p className="small">{t(lang, "docs.none_left")}</p>
        {status}
        <div className={s.after}>
          <Link className="btn" href={continueHref}>{t(lang, "docs.continue")}</Link>
        </div>
      </section>
    );
  }

  const body = (
    <div className="small">
      {has(lang, `ask.${current}.looks`) && <p>{t(lang, `ask.${current}.looks`)}</p>}
      {!reading && (
        <div className={`sans ${s.actions}`}>
          <FilePick label={t(lang, "docs.choose")} primary onFile={onFile} />
          <button type="button" className="link muted" onClick={onSkip}>{t(lang, "docs.skip")}</button>
        </div>
      )}
      {status}
    </div>
  );

  return (
    <section className="ask" aria-live="polite">
      <h2>{heading}</h2>
      {example ? (
        <div className="askgrid">
          <img className="example" src={example} alt="" />
          {body}
        </div>
      ) : (
        body
      )}
      <p className={`sans ${s.after}`}>
        <Link href={continueHref}>{t(lang, "docs.continue")}</Link>
      </p>
    </section>
  );
}
