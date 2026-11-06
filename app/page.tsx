"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine } from "@/components/Shell";
import { LANGS, t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";

/** 6.1. Two sentences on what this is and is not, a language, one button. */
export default function Welcome() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("es");
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
      <div className="row sans" style={{ marginTop: 24, gap: 18 }} role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button key={l} className="link" style={{ color: l === lang ? "var(--ink)" : undefined, textDecoration: l === lang ? "none" : undefined }} aria-pressed={l === lang} onClick={() => choose(l)} lang={l}>
            {t(l, `lang.${l}`)}
          </button>
        ))}
      </div>
      <h1>Earned</h1>
      <p>{t(lang, "welcome.p1")}</p>
      <p>{t(lang, "welcome.p2")}</p>
      <p>{t(lang, "welcome.p3")}</p>
      <div style={{ marginTop: 24 }}>
        <button className="btn" onClick={start} disabled={busy}>{t(lang, "welcome.start")}</button>
      </div>
      <p className="micro" style={{ marginTop: 28 }}>{t(lang, "welcome.depth")}</p>
      {err && <ErrorLine lang={lang} k={err} retry={start} />}
    </main>
  );
}
