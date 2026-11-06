"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";

type Props = { id: string; lang: Lang; name: string | null; active?: string; routeKind?: string; mock?: boolean; children: React.ReactNode; wide?: boolean };

/** Her journey, in order, numbered in the top bar. The other sections follow as plain links. */
const JOURNEY_DEEP = ["documents", "home", "position", "progress"] as const;
const JOURNEY_NONE = ["documents", "home", "position"] as const;
const MORE_DEEP = ["week", "route", "ask", "change"] as const;
const MORE_NONE = ["ask"] as const;
const NAV_KEYS: Record<string, string> = { position: "nav.where", documents: "nav.documents", route: "nav.route", week: "nav.week", progress: "nav.progress", home: "nav.home", circle: "nav.circle", ask: "nav.ask", change: "nav.change" };

export function Shell({ id, lang, name, active, routeKind, mock, children, wide }: Props) {
  const journey = routeKind === "none" ? JOURNEY_NONE : JOURNEY_DEEP;
  const more = routeKind === "none" ? MORE_NONE : MORE_DEEP;
  return (
    <div lang={lang}>
      <header className="top">
        <div className="wrap">
          <div className="bar">
            <a className="brand" href={`/c/${id}/home`} lang="en">
              <svg viewBox="0 0 30 20" aria-hidden="true"><path d="M3 17 A12 12 0 0 1 27 17" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="3" cy="17" r="2.4" fill="currentColor" /><circle cx="27" cy="17" r="2.4" fill="var(--accent)" /></svg>
              Bridge
            </a>
            <span className="name">{name ?? ""}</span>
          </div>
          <nav aria-label="Sections">
            {journey.map((k, i) => (
              <Link key={k} href={`/c/${id}/${k}`} aria-current={active === k ? "page" : undefined}><span className="step" aria-hidden="true">{i + 1}</span>{t(lang, NAV_KEYS[k])}</Link>
            ))}
            <span className="navgap" aria-hidden="true" />
            {more.map((k) => (
              <Link key={k} href={`/c/${id}/${k}`} aria-current={active === k ? "page" : undefined}>{t(lang, NAV_KEYS[k])}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main className={`wrap ${wide ? "wide" : ""}`}>
        {mock && <p className="micro" style={{ marginTop: 12 }}>{t(lang, "mock.note")}</p>}
        {children}
      </main>
    </div>
  );
}

export function Loading({ lang, text }: { lang: Lang; text?: string }) {
  return <main className="wrap"><p className="muted" style={{ marginTop: 32 }}>{text ?? t(lang, "position.updating")}</p></main>;
}

export function ErrorLine({ lang, k, retry }: { lang: Lang; k: string; retry?: () => void }) {
  return (
    <p className="muted" role="alert" style={{ marginTop: 16 }}>
      {t(lang, k)} {retry && <button className="link" onClick={retry}>{t(lang, "error.retry")}</button>}
    </p>
  );
}
