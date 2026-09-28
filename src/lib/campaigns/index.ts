import { getSupabaseAdmin } from "../supabase";
import { PREFERENCES_TOKEN_SCOPE, generateHmacToken, sendNotification } from "../notifications";
import { EMAIL_BASE_URL } from "../email/components";
import { recordConsent } from "../consent";
import { TOWNS_LAUNCH } from "./towns-launch";
import type { CampaignDefinition, Cohort } from "./types";

// ── Registry ──

export const CAMPAIGNS: Record<string, CampaignDefinition> = {
  [TOWNS_LAUNCH.slug]: TOWNS_LAUNCH,
};

export function getCampaignDefinition(slug: string): CampaignDefinition | null {
  return CAMPAIGNS[slug] ?? null;
}

// Circuit breaker: half of Resend's own account pause lines (4% bounces,
// 0.08% complaints), so a campaign stops well before the account would.
const MAX_BOUNCE_RATE = 0.02;
const MAX_COMPLAINT_RATE = 0.0005;
const BREAKER_MIN_SENT = 200;
const MAX_ATTEMPTS = 3;
const DAY_MS = 86_400_000;

export interface CampaignRow {
  id: number;
  slug: string;
  topic: string;
  status: "draft" | "sending" | "paused" | "done";
  pause_reason: string | null;
  holdout_pct: number;
  started_at: string | null;
}

export function campaignDedupKey(campaignId: number, developerId: number): string {
  return `campaign:${campaignId}:${developerId}`;
}

/** Signed link behind "Yes, keep me posted" in the permission email. */
export function buildConfirmUrl(developerId: number, campaignId: number): string {
  const token = generateHmacToken(developerId, PREFERENCES_TOKEN_SCOPE);
  return `${EMAIL_BASE_URL}/email-preferences/confirm?dev=${developerId}&token=${token}&campaign=${campaignId}`;
}

function cohortOf(lastActiveAt: string | null, now: number): Cohort {
  if (!lastActiveAt) return "dormant";
  const days = (now - Date.parse(lastActiveAt)) / DAY_MS;
  if (days <= 30) return "active30";
  if (days <= 90) return "active90";
  if (days <= 180) return "active180";
  return "dormant";
}

// ── Build: freeze the audience ──

/**
 * Snapshots who gets the campaign, one row per player, with cohort, variant
 * and send time. Skips anyone who turned email or the topic off, or whose
 * address bounced or complained. Safe to run once per campaign: rows are
 * keyed on (campaign, developer).
 */
export async function buildAudience(campaignId: number, startAt: Date): Promise<{ queued: number; holdout: number; excluded: number }> {
  const sb = getSupabaseAdmin();
  const { data: campaign } = await sb.from("campaigns").select("*").eq("id", campaignId).single<CampaignRow>();
  if (!campaign) throw new Error("Campaign not found");
  const def = getCampaignDefinition(campaign.slug);
  if (!def) throw new Error(`No template for ${campaign.slug}`);

  // Hard exclusions: small sets, loaded once
  const [{ data: optedOut }, { data: suppressed }] = await Promise.all([
    sb.from("notification_preferences").select("developer_id").or(`email_enabled.eq.false,${campaign.topic}.eq.false`),
    sb.from("notification_suppressions").select("identifier").eq("channel", "email"),
  ]);
  const excludedDevs = new Set((optedOut ?? []).map((r) => r.developer_id as number));
  const suppressedEmails = new Set((suppressed ?? []).map((r) => (r.identifier as string).toLowerCase()));

  const now = Date.now();
  const perCohortCount: Partial<Record<Cohort, number>> = {};
  let queued = 0;
  let holdout = 0;
  let excluded = 0;

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: devs, error } = await sb
      .from("developers")
      .select("id, email, last_active_at")
      .eq("claimed", true)
      .not("email", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!devs || devs.length === 0) break;

    const rows = [];
    for (const dev of devs) {
      if (excludedDevs.has(dev.id) || suppressedEmails.has(String(dev.email).toLowerCase())) {
        excluded++;
        continue;
      }
      const cohort = cohortOf(dev.last_active_at, now);
      const plan = def.schedule.find((s) => s.cohort === cohort);
      if (!plan) {
        excluded++;
        continue;
      }
      const isHoldout = Math.random() * 100 < campaign.holdout_pct;
      // Spread each cohort over days at its daily cap
      const n = perCohortCount[cohort] ?? 0;
      perCohortCount[cohort] = n + 1;
      const sendAfter = new Date(startAt.getTime() + plan.offsetHours * 3_600_000 + Math.floor(n / plan.perDay) * DAY_MS);
      rows.push({
        campaign_id: campaignId,
        developer_id: dev.id,
        cohort,
        variant: isHoldout ? "holdout" : def.variantFor(cohort),
        send_after: sendAfter.toISOString(),
        status: isHoldout ? "holdout" : "queued",
      });
      if (isHoldout) holdout++;
      else queued++;
    }

    if (rows.length) {
      const { error: insertError } = await sb
        .from("campaign_recipients")
        .upsert(rows, { onConflict: "campaign_id,developer_id", ignoreDuplicates: true });
      if (insertError) throw new Error(insertError.message);
    }
    if (devs.length < PAGE) break;
  }

  return { queued, holdout, excluded };
}

// ── Stats and breaker ──

export interface CampaignStats {
  recipients: Record<string, number>;
  byCohort: Record<string, Record<string, number>>;
  delivery: { sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number };
  confirmed: number;
}

export async function campaignStats(campaignId: number): Promise<CampaignStats> {
  const sb = getSupabaseAdmin();
  const recipients: Record<string, number> = {};
  const byCohort: Record<string, Record<string, number>> = {};
  const delivery = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await sb
      .from("campaign_recipients")
      .select("cohort, status")
      .eq("campaign_id", campaignId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      recipients[r.status] = (recipients[r.status] ?? 0) + 1;
      byCohort[r.cohort] ??= {};
      byCohort[r.cohort][r.status] = (byCohort[r.cohort][r.status] ?? 0) + 1;
    }
    if (data.length < PAGE) break;
  }

  for (let from = 0; ; from += PAGE) {
    const { data } = await sb
      .from("notification_log")
      .select("status, delivered_at, opened_at, clicked_at")
      .like("dedup_key", `campaign:${campaignId}:%`)
      .neq("status", "failed")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      delivery.sent++;
      if (r.delivered_at) delivery.delivered++;
      if (r.opened_at) delivery.opened++;
      if (r.clicked_at) delivery.clicked++;
      if (r.status === "bounced") delivery.bounced++;
      if (r.status === "complained") delivery.complained++;
    }
    if (data.length < PAGE) break;
  }

  const { count } = await sb
    .from("consent_events")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("action", "confirmed");

  return { recipients, byCohort, delivery, confirmed: count ?? 0 };
}

/** Pauses the campaign when bounces or complaints cross the breaker. Returns the reason, if tripped. */
async function checkBreaker(campaign: CampaignRow): Promise<string | null> {
  const { delivery } = await campaignStats(campaign.id);
  if (delivery.sent < BREAKER_MIN_SENT) return null;
  const bounceRate = delivery.bounced / delivery.sent;
  const complaintRate = delivery.complained / delivery.sent;
  let reason: string | null = null;
  if (bounceRate > MAX_BOUNCE_RATE) reason = `bounce rate ${(bounceRate * 100).toFixed(2)}% over ${MAX_BOUNCE_RATE * 100}%`;
  else if (complaintRate > MAX_COMPLAINT_RATE) reason = `complaint rate ${(complaintRate * 100).toFixed(3)}% over ${MAX_COMPLAINT_RATE * 100}%`;
  if (reason) {
    await getSupabaseAdmin().from("campaigns").update({ status: "paused", pause_reason: reason }).eq("id", campaign.id);
  }
  return reason;
}

// ── Run: send what's due ──

/**
 * Sends a sending campaign's due rows through the notification engine, so
 * preferences, suppressions, per-player caps and dedup all apply. A player
 * over their daily cap is retried the next day.
 */
export async function runCampaign(campaign: CampaignRow, opts: { limit: number; deadline: number }) {
  const sb = getSupabaseAdmin();
  const def = getCampaignDefinition(campaign.slug);
  if (!def) return { sent: 0, skipped: 0, failed: 0, paused: `no template for ${campaign.slug}` };

  const tripped = await checkBreaker(campaign);
  if (tripped) return { sent: 0, skipped: 0, failed: 0, paused: tripped };

  const { data: stats } = await sb.from("city_stats").select("total_developers").eq("id", 1).maybeSingle();
  const buildings = stats?.total_developers ?? 0;

  const { data: due } = await sb
    .from("campaign_recipients")
    .select("developer_id, variant, attempts")
    .eq("campaign_id", campaign.id)
    .eq("status", "queued")
    .lte("send_after", new Date().toISOString())
    .order("send_after", { ascending: true })
    .limit(opts.limit);

  const result = { sent: 0, skipped: 0, failed: 0, paused: null as string | null };
  if (!due || due.length === 0) {
    const { count } = await sb
      .from("campaign_recipients")
      .select("developer_id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "queued");
    if (!count) await sb.from("campaigns").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", campaign.id);
    return result;
  }

  const ids = due.map((d) => d.developer_id);
  const { data: devs } = await sb.from("developers").select("id, github_login").in("id", ids);
  const loginOf = new Map((devs ?? []).map((d) => [d.id as number, d.github_login as string]));

  for (const row of due) {
    if (Date.now() > opts.deadline) break;
    const login = loginOf.get(row.developer_id) ?? "there";
    const confirmUrl = buildConfirmUrl(row.developer_id, campaign.id);
    const header = def.render(row.variant, { login, links: {}, confirmUrl, stats: { buildings } });

    const results = await sendNotification({
      type: `campaign_${campaign.slug.replace(/-/g, "_")}`,
      category: def.topic,
      developerId: row.developer_id,
      dedupKey: campaignDedupKey(campaign.id, row.developer_id),
      title: header.subject,
      body: header.preheader,
      render: (links) => def.render(row.variant, { login, links, confirmUrl, stats: { buildings } }),
      priority: "high",
      channels: ["email"],
    });
    const r = results[0];
    const now = new Date().toISOString();
    const update = (fields: Record<string, unknown>) =>
      sb.from("campaign_recipients").update(fields).eq("campaign_id", campaign.id).eq("developer_id", row.developer_id);

    if (r?.success) {
      result.sent++;
      await update({ status: "sent", sent_at: now });
    } else if (r?.skipped?.startsWith("rate_limited") && row.attempts + 1 < MAX_ATTEMPTS) {
      // Over the player's email cap today: try again tomorrow
      await update({ attempts: row.attempts + 1, send_after: new Date(Date.now() + DAY_MS).toISOString() });
    } else if ((r?.skipped === "resend_error" || r?.skipped === "send_error") && row.attempts + 1 < MAX_ATTEMPTS) {
      result.failed++;
      await update({ attempts: row.attempts + 1, send_after: new Date(Date.now() + 3_600_000).toISOString() });
    } else {
      result.skipped++;
      await update({ status: r?.skipped === "duplicate" ? "sent" : "skipped", skip_reason: r?.skipped ?? "unknown" });
    }
  }

  return result;
}

// ── Sunset: permission not given ──

/**
 * Turns product news off for permission-email recipients who didn't confirm
 * within `graceDays` of getting it. Logged as consent source "sunset".
 */
export async function sunsetUnconfirmed(campaignId: number, graceDays = 14): Promise<number> {
  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - graceDays * DAY_MS).toISOString();
  let turnedOff = 0;

  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const { data: rows } = await sb
      .from("campaign_recipients")
      .select("developer_id")
      .eq("campaign_id", campaignId)
      .eq("variant", "repermission")
      .eq("status", "sent")
      .lte("sent_at", cutoff)
      .order("developer_id")
      .range(from, from + PAGE - 1);
    if (!rows || rows.length === 0) break;

    const ids = rows.map((r) => r.developer_id);
    const { data: confirmed } = await sb
      .from("consent_events")
      .select("developer_id")
      .eq("campaign_id", campaignId)
      .eq("action", "confirmed")
      .in("developer_id", ids);
    const keep = new Set((confirmed ?? []).map((c) => c.developer_id));

    for (const id of ids) {
      if (keep.has(id)) continue;
      const { error } = await sb
        .from("notification_preferences")
        .upsert({ developer_id: id, product_news: false, updated_at: new Date().toISOString() }, { onConflict: "developer_id" });
      if (!error) {
        turnedOff++;
        await recordConsent({ developerId: id, topic: "product_news", action: "unsubscribed", source: "sunset", campaignId });
      }
    }
    if (rows.length < PAGE) break;
  }
  return turnedOff;
}
