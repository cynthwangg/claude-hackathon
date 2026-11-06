"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/components/api";
import { ErrorLine, Loading, Shell } from "@/components/Shell";
import type { Header } from "@/components/types";
import { t } from "@/lib/i18n";

type Item = { id: string; kind: string; title: string; state: string; state_word: string; statement_only: boolean; since: string | null; deadline: string | null; can_undo: boolean };
const NEXT: Record<string, string | null> = { not_started: "sent", sent: "document_obtained", document_obtained: "submitted", submitted: "accepted", accepted: null };

/** 6.8. Submitted is not accepted. Only a CTC notice makes anything official (D10). */
export default function ProgressPage() {
  const { id } = useParams<{ id: string }>();
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const pos = await api<{ header: Header }>(`/api/cases/${id}/position`);
      setHeader(pos.header);
      setItems((await api<{ actions: Item[] }>(`/api/cases/${id}/progress`)).actions);
    } catch (e) {
      setErr(errorKey(e));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!header || !items) return err ? <main className="wrap"><ErrorLine lang="en" k={err} retry={load} /></main> : <Loading lang="en" />;
  const lang = header.lang;

  const move = async (x: Item, body: { state?: string; undo?: boolean }) => {
    await api(`/api/actions/${x.id}/transition`, { method: "POST", json: body });
    load();
  };

  return (
    <Shell id={id} lang={lang} name={header.name} active="progress" routeKind={header.route_kind} mock={header.mock}>
      <h1>{t(lang, "progress.title")}</h1>
      {items.length === 0 && <p className="muted">{t(lang, "progress.empty")}</p>}
      {items.map((x) => {
        const next = NEXT[x.state];
        return (
          <div key={x.id} className="item" style={{ display: "block" }}>
            <div><strong style={{ fontWeight: 500 }}>{x.title}</strong> · {x.state_word}{x.since && <span className="small muted"> · {x.since}</span>}{x.deadline && <span className="small muted"> · {x.deadline}</span>}</div>
            <div className="row sans" style={{ marginTop: 4 }}>
              {next && <button className="link" onClick={() => move(x, { state: next })}>{t(lang, `progress.to.${next}`)}</button>}
              {x.statement_only && <Link className="link" href={`/c/${id}/documents`}>{t(lang, "progress.upload_notice")}</Link>}
              {x.can_undo && <button className="link muted" onClick={() => move(x, { undo: true })}>{t(lang, "progress.undo")}</button>}
            </div>
          </div>
        );
      })}
      <p className="small muted" style={{ marginTop: 16 }}>{t(lang, "progress.ctc_note")}</p>
    </Shell>
  );
}
