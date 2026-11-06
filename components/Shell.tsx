"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Lang } from "@/rules/types";

type Props = { id: string; lang: Lang; name: string | null; active?: string; routeKind?: string; mock?: boolean; children: React.ReactNode; wide?: boolean };

const NAV_DEEP = ["position", "documents", "route", "week", "progress", "ask"] as const;
const NAV_KEYS: Record<string, string> = { position: "nav.where", documents: "nav.documents", route: "nav.route", week: "nav.week", progress: "nav.progress", ask: "nav.ask", change: "nav.change" };

export function Shell({ id, lang, name, active, routeKind, mock, children, wide }: Props) {
  const items = routeKind === "none" ? (["position", "documents", "ask"] as const) : NAV_DEEP;
  return (
    <div lang={lang}>
      <header className="top">
        <div className="wrap">
          <span className="name">{name ?? ""}</span>
          <nav aria-label="Sections">
            {items.map((k) => (
              <Link key={k} href={`/c/${id}/${k}`} aria-current={active === k ? "page" : undefined}>{t(lang, NAV_KEYS[k])}</Link>
            ))}
            {routeKind !== "none" && <Link href={`/c/${id}/change`} aria-current={active === "change" ? "page" : undefined}>{t(lang, NAV_KEYS.change)}</Link>}
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
