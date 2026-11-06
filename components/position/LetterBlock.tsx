"use client";

import type { Line } from "@/components/types";
import { t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";
import s from "./position.module.css";

export type LetterItem = { number: number; text: string; rule_id: string | null; paperwork: boolean; named: string[] };

type Props = { lang: Lang; items: LetterItem[]; lines: Line[]; transcriptId: string | null; onWhy: (ruleId: string) => void };

/** 7.1 step 5. Each letter item as printed, and for the practicum, the transcript lines that answer it. */
export function LetterBlock({ lang, items, lines, transcriptId, onWhy }: Props) {
  return (
    <section className="section first">
      <h2>{t(lang, "position.letter_items")}</h2>
      {items.map((it) => {
        const line = it.rule_id ? lines.find((l) => l.rule_id === it.rule_id) : undefined;
        const found = it.paperwork && it.named.length > 0;
        return (
          <div key={it.number} className={s.entry}>
            <span className={`micro ${s.num}`}>{t(lang, "position.letter_item", { n: it.number })}</span>
            <blockquote className={s.quote} lang="en">“{it.text}”</blockquote>

            {found && (
              <>
                <div className={s.found}>
                  <div className={s.lines}>
                    <span className="micro">{t(lang, "position.letter_from_transcript")}</span>
                    {it.named.map((n) => <div key={n}><span className="mark">{n}</span></div>)}
                  </div>
                  {transcriptId && (
                    <a className={s.thumb} href={`/api/files/${transcriptId}`} target="_blank" rel="noreferrer">
                      <img src={`/api/files/${transcriptId}?preview=1`} alt={t(lang, "position.transcript_open")} />
                    </a>
                  )}
                </div>
                <p className={s.plain}>{t(lang, "position.letter_paperwork_short")}</p>
              </>
            )}

            {!it.rule_id && <p className="micro" style={{ margin: "6px 0 0" }}>{t(lang, "position.letter_unmatched")}</p>}
            {line && (
              <div className={s.stateLine}>
                <button className={`state ${s.quiet}`} onClick={() => onWhy(line.rule_id)} aria-haspopup="dialog">{line.state_word}</button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
