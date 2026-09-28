"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampaignStats } from "@/lib/campaigns";
import type { CohortSchedule } from "@/lib/campaigns/types";
import { Badge, Button, SectionTitle, fmt, pct } from "./ui";

interface CampaignView {
  id: number;
  slug: string;
  topic: string;
  status: "draft" | "sending" | "paused" | "done";
  pause_reason: string | null;
  holdout_pct: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  stats: CampaignStats;
}

interface Template {
  slug: string;
  topic: string;
  schedule: CohortSchedule[];
}

const COHORT_LABELS: Record<string, string> = {
  active30: "Active ≤ 30 days",
  active90: "Active 31–90 days",
  active180: "Active 91–180 days",
  dormant: "Idle 180+ days",
};

const STATUS_TONE = { draft: "muted", sending: "lime", paused: "yellow", done: "blue" } as const;

type Toast = (type: "success" | "error", msg: string) => void;

export function CampaignsTab({ onToast }: { onToast: Toast }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/campaigns");
    if (!res.ok) {
      onToast("error", `Couldn't load campaigns (HTTP ${res.status})`);
      return;
    }
    const body = await res.json();
    setTemplates(body.templates);
    setCampaigns(body.campaigns);
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (label: string, payload: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(label);
    try {
      const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onToast("success", successMessage(payload.action as string, body));
      await load();
    } catch (e) {
      onToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const unused = templates.filter((t) => !campaigns?.some((c) => c.slug === t.slug));

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Templates</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const used = campaigns?.some((c) => c.slug === t.slug);
            return (
              <div key={t.slug} className="border border-border bg-bg-raised p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-cream">{t.slug}</span>
                  <Badge>{t.topic.replace("_", " ")}</Badge>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  {t.schedule.map((s) => `${COHORT_LABELS[s.cohort]} +${s.offsetHours}h`).join(" · ")}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => act(`test-${t.slug}`, { action: "test", slug: t.slug })} disabled={!!busy}>Send me a test</Button>
                  {!used && <Button variant="primary" onClick={() => act(`create-${t.slug}`, { action: "create", slug: t.slug })} disabled={!!busy}>Create campaign</Button>}
                </div>
              </div>
            );
          })}
        </div>
        {templates.length > 0 && unused.length === 0 && <p className="mt-2 text-[10px] text-dim">Every template has a campaign. New templates live in src/lib/campaigns/.</p>}
      </section>

      <section>
        <SectionTitle>Campaigns</SectionTitle>
        {campaigns === null ? (
          <div className="h-40 animate-pulse border border-border bg-bg-raised" />
        ) : campaigns.length === 0 ? (
          <p className="border border-border bg-bg-raised px-4 py-8 text-center text-[11px] text-dim">No campaigns yet. Create one from a template above.</p>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => <CampaignCard key={c.id} c={c} busy={busy} act={act} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function successMessage(action: string, body: Record<string, unknown>): string {
  switch (action) {
    case "test": return `Test sent to ${body.to}`;
    case "create": return "Campaign created as a draft";
    case "build": return `Audience built: ${fmt(Number(body.queued))} queued, ${fmt(Number(body.holdout))} holdout, ${fmt(Number(body.excluded))} excluded`;
    case "start": return "Campaign started. The runner sends every 5 minutes.";
    case "resume": return "Campaign resumed";
    case "pause": return "Campaign paused";
    case "sunset": return `Product news turned off for ${fmt(Number(body.turnedOff))} players`;
    default: return "Done";
  }
}

function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function CampaignCard({ c, busy, act }: {
  c: CampaignView;
  busy: string | null;
  act: (label: string, payload: Record<string, unknown>, confirmText?: string) => Promise<void>;
}) {
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() + 3_600_000)));
  const r = c.stats.recipients;
  const audience = (r.queued ?? 0) + (r.sent ?? 0) + (r.skipped ?? 0) + (r.failed ?? 0);
  const built = audience + (r.holdout ?? 0) > 0;
  const d = c.stats.delivery;
  const progress = audience ? ((r.sent ?? 0) + (r.skipped ?? 0)) / audience : 0;

  return (
    <div className="border border-border bg-bg-raised">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-cream">{c.slug}</span>
            <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
          </div>
          <p className="mt-1 text-[10px] text-dim">
            #{c.id} · created {new Date(c.created_at).toLocaleDateString("en-US")}
            {c.started_at && ` · started ${new Date(c.started_at).toLocaleString("en-US")}`}
            {c.finished_at && ` · finished ${new Date(c.finished_at).toLocaleString("en-US")}`}
            {` · ${c.holdout_pct}% holdout`}
          </p>
          {c.pause_reason && <p className="mt-2 text-[11px] text-yellow-400">Paused: {c.pause_reason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.status === "draft" && !built && (
            <>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-label="First send time" className="border border-border bg-bg px-2 py-1 text-[11px] text-cream [color-scheme:dark]" />
              <Button onClick={() => act(`build-${c.id}`, { action: "build", id: c.id, startAt: new Date(startAt).toISOString() }, "Freeze the audience now? Players who change settings later are still respected at send time.")} disabled={!!busy}>
                Build audience
              </Button>
            </>
          )}
          {c.status === "draft" && built && <Button variant="primary" onClick={() => act(`start-${c.id}`, { action: "start", id: c.id }, `Start sending ${c.slug} to ${fmt(audience)} players on the schedule?`)} disabled={!!busy}>Start sending</Button>}
          {c.status === "sending" && <Button onClick={() => act(`pause-${c.id}`, { action: "pause", id: c.id })} disabled={!!busy}>Pause</Button>}
          {c.status === "paused" && <Button variant="primary" onClick={() => act(`resume-${c.id}`, { action: "resume", id: c.id }, "Resume sending?")} disabled={!!busy}>Resume</Button>}
          {(c.status === "sending" || c.status === "done" || c.status === "paused") && (
            <Button variant="danger" onClick={() => act(`sunset-${c.id}`, { action: "sunset", id: c.id }, "Turn product news off for permission-email recipients who didn't confirm in 14 days?")} disabled={!!busy}>
              Sunset unconfirmed
            </Button>
          )}
        </div>
      </div>

      {built ? (
        <div className="grid gap-6 p-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-2 flex justify-between text-[11px]">
              <span className="text-muted">Progress</span>
              <span className="tabular-nums text-cream">{fmt((r.sent ?? 0) + (r.skipped ?? 0))} / {fmt(audience)}</span>
            </div>
            <div className="h-1.5 bg-bg"><div className="h-full bg-lime" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <div className="mt-4 grid grid-cols-3 gap-px bg-border sm:grid-cols-6">
              <Metric label="Sent" value={fmt(d.sent)} />
              <Metric label="Delivered" value={pct(d.delivered, d.sent)} />
              <Metric label="Opened" value={pct(d.opened, d.delivered)} />
              <Metric label="Clicked" value={pct(d.clicked, d.delivered)} />
              <Metric label="Bounced" value={pct(d.bounced, d.sent, 2)} warn={d.sent > 0 && d.bounced / d.sent > 0.02} />
              <Metric label="Complaints" value={fmt(d.complained)} warn={d.complained > 0} />
            </div>
            <p className="mt-2 text-[10px] text-dim">
              {fmt(c.stats.confirmed)} confirmed &ldquo;keep me posted&rdquo; · {fmt(r.skipped ?? 0)} skipped by settings or caps · {fmt(r.holdout ?? 0)} held out to measure lift. Auto-pauses above 2% bounces or 0.05% complaints.
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] text-muted">By cohort</p>
            <table className="w-full text-[11px]">
              <tbody>
                {Object.entries(c.stats.byCohort).map(([cohort, s]) => {
                  const total = Object.values(s).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={cohort} className="border-b border-border last:border-0">
                      <td className="py-1.5 text-muted">{COHORT_LABELS[cohort] ?? cohort}</td>
                      <td className="py-1.5 text-right tabular-nums text-cream">{fmt(s.sent ?? 0)} / {fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="p-4 text-[11px] text-dim">Pick when the first wave goes out, then build the audience. Nothing sends until you press Start.</p>
      )}
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-bg-raised p-3">
      <p className="text-[10px] text-dim">{label}</p>
      <p className={`mt-1 text-sm tabular-nums ${warn ? "text-red-400" : "text-cream"}`}>{value}</p>
    </div>
  );
}
