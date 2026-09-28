"use client";

import { useMemo, useState } from "react";
import type { DeliveryCounts, EmailsOverview } from "@/app/api/admin/emails/route";
import { EMAIL_CATALOG } from "@/lib/email/catalog";
import { topicLabel } from "@/lib/email/topics";
import { SectionTitle, StatCard, fmt, pct } from "./ui";

// Health lines: stricter than Resend's account pause (4% bounce, 0.08% complaint)
const LIMITS = { failed: 0.01, bounced: 0.02, complained: 0.0005 };

function nameForType(type: string): string {
  const entry = EMAIL_CATALOG.find((e) => e.types.includes(type));
  if (!entry) return type.replace(/_/g, " ");
  // Batched digests are "<type>_digest"; the weekly recap's own type is "weekly_digest"
  const isBatch = (t: string) => t.endsWith("_digest") && entry.types.includes(t.replace(/_digest$/, ""));
  if (isBatch(type)) return `${entry.name} · digest`;
  const plain = entry.types.filter((t) => !isBatch(t));
  return plain.length > 1 ? `${entry.name} · ${type.replace(/_/g, " ")}` : entry.name;
}

function rateTone(part: number, whole: number, limit: number): "red" | "yellow" | undefined {
  if (!whole) return undefined;
  const r = part / whole;
  if (r > limit) return "red";
  if (r > limit / 2) return "yellow";
  return undefined;
}

export function OverviewTab({ overview }: { overview: EmailsOverview | null }) {
  if (!overview) return <OverviewSkeleton />;
  const t = overview.totals;
  const attempted = t.sent + t.failed;

  const alerts = [
    rateTone(t.failed, attempted, LIMITS.failed) === "red" && `Failed sends at ${pct(t.failed, attempted, 2)}, over 1%. Check Resend and the rate limiter.`,
    rateTone(t.bounced, t.sent, LIMITS.bounced) === "red" && `Bounce rate at ${pct(t.bounced, t.sent, 2)}, over 2%.`,
    rateTone(t.complained, t.sent, LIMITS.complained) === "red" && `Spam complaints at ${pct(t.complained, t.sent, 3)}, over 0.05%. Pause campaigns.`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      {attempted === 0 ? (
        <div className="border border-border bg-bg-raised px-4 py-3 text-xs text-muted">No emails sent in the last {overview.days} days.</div>
      ) : alerts.length > 0 ? (
        <div className="space-y-1 border border-red-800/30 bg-red-900/15 px-4 py-3">
          {alerts.map((a) => <p key={a} className="text-xs text-red-400">{a}</p>)}
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-lime/20 bg-lime/5 px-4 py-3 text-xs text-lime">
          <span className="inline-block h-2 w-2 bg-lime" aria-hidden /> Healthy: failures, bounces and complaints are all under their limits.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Sent" value={fmt(t.sent)} sub={`last ${overview.days} days`} />
        <StatCard label="Delivered" value={pct(t.delivered, t.sent)} sub={`${fmt(t.delivered)} emails`} tone="lime" />
        <StatCard label="Opened" value={pct(t.opened, t.delivered)} sub="of delivered" />
        <StatCard label="Clicked" value={pct(t.clicked, t.delivered)} sub="of delivered" />
        <StatCard label="Bounced" value={pct(t.bounced, t.sent, 2)} sub={`${fmt(t.bounced)} · limit 2%`} tone={rateTone(t.bounced, t.sent, LIMITS.bounced)} />
        <StatCard label="Failed" value={pct(t.failed, attempted, 2)} sub={`${fmt(t.failed)} · limit 1%`} tone={rateTone(t.failed, attempted, LIMITS.failed)} />
      </div>

      <section>
        <SectionTitle right={<Legend />}>Emails per day</SectionTitle>
        <DailyChart daily={overview.daily} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <section className="min-w-0">
          <SectionTitle>By email</SectionTitle>
          <TypeTable byType={overview.byType} />
        </section>
        <aside className="min-w-0 space-y-8">
          <section>
            <SectionTitle>Unsubscribes · {overview.days}d</SectionTitle>
            <div className="border border-border bg-bg-raised">
              {overview.unsubscribes.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-dim">None</p>
              ) : (
                overview.unsubscribes.map((u) => (
                  <div key={u.topic} className="flex justify-between border-b border-border px-4 py-2 text-[11px] last:border-0">
                    <span className="text-muted">{topicLabel(u.topic)}</span>
                    <span className="tabular-nums text-cream">{u.count}</span>
                  </div>
                ))
              )}
            </div>
          </section>
          <section>
            <SectionTitle>Blocked addresses</SectionTitle>
            <div className="border border-border bg-bg-raised">
              <Row label="Hard bounces" value={overview.suppressions.bounce} />
              <Row label="Spam complaints" value={overview.suppressions.complaint} />
              <Row label={`New in ${overview.days}d`} value={overview.suppressions.recent} />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-dim">These addresses get nothing but receipts. Gmail doesn&apos;t report complaints to senders; its rate lives in Postmaster Tools.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-border px-4 py-2 text-[11px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-cream">{fmt(value)}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] text-dim">
      <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 bg-lime/80" />delivered</span>
      <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 bg-muted/60" />no receipt yet</span>
      <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 bg-red-400" />failed or bounced</span>
    </div>
  );
}

function DailyChart({ daily }: { daily: EmailsOverview["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.delivered + d.pending + d.problems));
  const H = 140;
  const barW = 100 / daily.length;
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const h = hover !== null ? daily[hover] : null;

  return (
    <div className="relative border border-border bg-bg-raised p-4">
      <div className="mb-2 h-4 text-[11px] text-muted">
        {h ? (
          <span>
            <span className="text-cream">{label(h.date)}</span> · {fmt(h.delivered)} delivered · {fmt(h.pending)} no receipt · {fmt(h.problems)} failed or bounced
          </span>
        ) : (
          <span className="text-dim">Hover a day</span>
        )}
      </div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Emails sent per day">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2="100" y1={H * f} y2={H * f} stroke="var(--color-border)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {daily.map((d, i) => {
          const total = d.delivered + d.pending + d.problems;
          const x = i * barW + barW * 0.15;
          const w = barW * 0.7;
          let y = H;
          const seg = (value: number, cls: string) => {
            const hh = (value / max) * (H - 4);
            y -= hh;
            return value > 0 ? <rect key={cls} x={x} y={y} width={w} height={hh} className={cls} /> : null;
          };
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} opacity={hover === null || hover === i ? 1 : 0.45}>
              <rect x={i * barW} y={0} width={barW} height={H} fill="transparent" />
              {seg(d.delivered, "fill-lime/80")}
              {seg(d.pending, "fill-muted/60")}
              {seg(d.problems, "fill-red-400")}
              {total === 0 && <rect x={x} y={H - 1} width={w} height={1} className="fill-border" />}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-dim">
        <span>{label(daily[0].date)}</span>
        <span>{label(daily[Math.floor(daily.length / 2)].date)}</span>
        <span>{label(daily[daily.length - 1].date)}</span>
      </div>
    </div>
  );
}

type SortKey = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";

function TypeTable({ byType }: { byType: Record<string, DeliveryCounts> }) {
  const [sort, setSort] = useState<SortKey>("sent");
  const rows = useMemo(
    () => Object.entries(byType).sort(([, a], [, b]) => b[sort] - a[sort]),
    [byType, sort],
  );
  if (rows.length === 0) return <p className="border border-border bg-bg-raised px-4 py-6 text-center text-[11px] text-dim">No emails in this period</p>;

  const head = (key: SortKey, label: string) => (
    <th className="px-3 py-2 text-right font-normal">
      <button onClick={() => setSort(key)} className={`cursor-pointer ${sort === key ? "text-lime" : "hover:text-cream"}`}>{label}{sort === key ? " ↓" : ""}</button>
    </th>
  );

  return (
    <div className="overflow-x-auto border border-border bg-bg-raised">
      <table className="w-full min-w-[640px] text-[11px]">
        <thead className="border-b border-border text-dim">
          <tr>
            <th className="px-3 py-2 text-left font-normal">Email</th>
            {head("sent", "Sent")}
            {head("delivered", "Delivered")}
            {head("opened", "Opened")}
            {head("clicked", "Clicked")}
            {head("bounced", "Bounced")}
            {head("failed", "Failed")}
          </tr>
        </thead>
        <tbody>
          {rows.map(([type, c]) => (
            <tr key={type} className="border-b border-border last:border-0 hover:bg-bg-card">
              <td className="px-3 py-2 text-cream">{nameForType(type)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-cream">{fmt(c.sent)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{pct(c.delivered, c.sent)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{pct(c.opened, c.delivered)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{pct(c.clicked, c.delivered)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${rateTone(c.bounced, c.sent, LIMITS.bounced) === "red" ? "text-red-400" : "text-muted"}`}>{c.bounced ? fmt(c.bounced) : "–"}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${rateTone(c.failed, c.sent + c.failed, LIMITS.failed) === "red" ? "text-red-400" : "text-muted"}`}>{c.failed ? fmt(c.failed) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-11 animate-pulse border border-border bg-bg-raised" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse border border-border bg-bg-raised" />)}
      </div>
      <div className="h-52 animate-pulse border border-border bg-bg-raised" />
    </div>
  );
}
