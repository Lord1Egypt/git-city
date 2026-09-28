"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailsOverview } from "@/app/api/admin/emails/route";
import { EMAIL_AREAS, EMAIL_CATALOG, type CatalogEmail, type EmailArea } from "@/lib/email/catalog";
import { EMAIL_TOPICS } from "@/lib/email/topics";
import { Badge, Button, ButtonGroup, fmt, pct } from "./ui";

type AreaFilter = EmailArea | "all";

function categoryBadge(category: string) {
  if (category === "transactional") return <Badge tone="blue">always sent</Badge>;
  const topic = EMAIL_TOPICS.find((t) => t.key === category);
  return <Badge>{topic?.label ?? category}</Badge>;
}

export function CatalogTab({ overview, onToast }: { overview: EmailsOverview | null; onToast: (type: "success" | "error", msg: string) => void }) {
  const [area, setArea] = useState<AreaFilter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<CatalogEmail | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EMAIL_CATALOG.filter((e) => (area === "all" || e.area === area) && (!needle || `${e.name} ${e.trigger} ${e.audience}`.toLowerCase().includes(needle)));
  }, [area, q]);

  const statsFor = (e: CatalogEmail) => {
    if (!overview || e.types.length === 0) return null;
    let sent = 0;
    let clicked = 0;
    let delivered = 0;
    for (const t of e.types) {
      const c = overview.byType[t];
      if (!c) continue;
      sent += c.sent;
      clicked += c.clicked;
      delivered += c.delivered;
    }
    return { sent, clicked, delivered };
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ButtonGroup<AreaFilter>
          options={[{ value: "all", label: `All ${EMAIL_CATALOG.length}` }, ...EMAIL_AREAS.map((a) => ({ value: a.key as AreaFilter, label: a.label }))]}
          value={area}
          onChange={setArea}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emails..."
          aria-label="Search emails"
          className="w-full border border-border bg-bg px-3 py-1.5 text-[11px] text-cream placeholder:text-dim focus:border-lime/50 focus:outline-none sm:w-56"
        />
      </div>

      <div className="overflow-x-auto border border-border bg-bg-raised">
        <table className="w-full min-w-[760px] text-[11px]">
          <thead className="border-b border-border text-dim">
            <tr>
              <th className="px-3 py-2 text-left font-normal">Email</th>
              <th className="px-3 py-2 text-left font-normal">Sent when</th>
              <th className="px-3 py-2 text-left font-normal">Setting</th>
              <th className="px-3 py-2 text-left font-normal">From</th>
              <th className="px-3 py-2 text-right font-normal">Sent · {overview?.days ?? 30}d</th>
              <th className="px-3 py-2 text-right font-normal">Clicked</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const s = statsFor(e);
              return (
                <tr key={e.name} className="group border-b border-border last:border-0 hover:bg-bg-card">
                  <td className="px-3 py-2.5">
                    <button onClick={() => setOpen(e)} className="cursor-pointer text-left text-cream hover:text-lime">{e.name}</button>
                    <p className="mt-0.5 text-[10px] text-dim">{e.audience}</p>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 text-muted">{e.trigger}</td>
                  <td className="px-3 py-2.5">{categoryBadge(e.category)}</td>
                  <td className="px-3 py-2.5 text-dim">{e.sender}.</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-cream">{s ? fmt(s.sent) : <span className="text-dim" title="Direct send, not in the engine log">not logged</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{s ? pct(s.clicked, s.delivered) : "–"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => setOpen(e)} className="cursor-pointer text-[10px] text-dim hover:text-lime">Preview →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-center text-[11px] text-dim">No email matches</p>}
      </div>

      {open && <PreviewDrawer email={open} onClose={() => setOpen(null)} onToast={onToast} />}
    </div>
  );
}

function PreviewDrawer({ email, onClose, onToast }: { email: CatalogEmail; onClose: () => void; onToast: (type: "success" | "error", msg: string) => void }) {
  const [variant, setVariant] = useState(email.previews[0]);
  const [sending, setSending] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  // The site sends X-Frame-Options: DENY, so the email is fetched and shown
  // through srcDoc in a sandboxed frame instead of framing the URL.
  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    fetch(`/api/admin/email-preview?template=${encodeURIComponent(variant)}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => !cancelled && setHtml(text))
      .catch(() => !cancelled && setHtml("<p style='font:14px sans-serif;color:#f87171;padding:24px'>Couldn't load this preview.</p>"));
    return () => {
      cancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/email-preview?template=${encodeURIComponent(variant)}&send=1`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onToast("success", `Sent to ${body.to}`);
    } catch (e) {
      onToast("error", e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${email.name} preview`}>
      <button className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-label="Close preview" />
      <div className="relative flex h-full w-full max-w-[720px] flex-col border-l border-border bg-bg">
        <div className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm text-cream">{email.name}</h2>
              <p className="mt-1 text-[11px] text-muted">{email.trigger}</p>
            </div>
            <button onClick={onClose} className="cursor-pointer text-xs text-dim hover:text-cream" aria-label="Close">Esc ×</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            {categoryBadge(email.category)}
            <Badge>{email.sender}.thegitcity.com</Badge>
            <Badge>{email.audience}</Badge>
            <span className="self-center text-dim">src/lib/{email.source}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {email.previews.length > 1 ? (
              <ButtonGroup options={email.previews.map((p) => ({ value: p, label: p }))} value={variant} onChange={setVariant} />
            ) : (
              <span className="text-[10px] text-dim">{variant}</span>
            )}
            <Button variant="primary" onClick={sendTest} disabled={sending}>{sending ? "Sending..." : "Send me a test"}</Button>
          </div>
        </div>
        {html === null ? (
          <div className="flex-1 animate-pulse bg-bg-raised" />
        ) : (
          <iframe title={`${email.name} preview`} srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="w-full flex-1 bg-bg" />
        )}
      </div>
    </div>
  );
}
