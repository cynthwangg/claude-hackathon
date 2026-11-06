"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine } from "@/components/Shell";
import { t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";
import s from "./welcome.module.css";

const ORDER: Lang[] = ["en", "es", "zh"];

/** 6.1. Her situation in one sentence, what happens next in one line, a language, one button. */
export default function Welcome() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("earned.lang");
    if (saved === "en" || saved === "es" || saved === "zh") setLang(saved);
  }, []);

  const choose = (l: Lang) => {
    setLang(l);
    localStorage.setItem("earned.lang", l);
  };

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { case_id } = await api<{ case_id: string }>("/api/cases", { method: "POST", json: { language: lang } });
      router.push(`/c/${case_id}`);
    } catch (e) {
      setErr(errorKey(e));
      setBusy(false);
    }
  };

  return (
    <main className="wrap" lang={lang}>
      <div className={s.top}>
        <span className={s.brand} lang="en">Earned</span>
        <div className={s.langs} role="group" aria-label="Language">
          {ORDER.map((l) => (
            <button key={l} type="button" className={`link ${s.lang}`} aria-pressed={l === lang} onClick={() => choose(l)} lang={l}>
              {t(l, `lang.${l}`)}
            </button>
          ))}
        </div>
      </div>
      <h1 className={s.title}>{t(lang, "welcome.p1")}</h1>
      <p>{t(lang, "welcome.p2")}</p>
      <p className="muted">{t(lang, "welcome.p3")}</p>
      <div className={s.action}>
        <button type="button" className="btn" onClick={start} disabled={busy}>{t(lang, "welcome.start")}</button>
      </div>
      <p className={`micro ${s.depth}`}>{t(lang, "welcome.depth")}</p>
      {err && <ErrorLine lang={lang} k={err} retry={start} />}
    </main>
  );
}
