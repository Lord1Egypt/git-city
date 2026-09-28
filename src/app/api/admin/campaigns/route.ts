import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdminUser } from "@/lib/auth-identity";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { FROM_MAIL } from "@/lib/email/senders";
import { LEGAL_EMAIL, LEGAL_POSTAL_ADDRESS } from "@/lib/legal";
import { CAMPAIGNS, buildAudience, buildConfirmUrl, campaignStats, getCampaignDefinition, sunsetUnconfirmed, type CampaignRow } from "@/lib/campaigns";

export const maxDuration = 300;

/** Admin session, or the cron secret for scripted runs. Returns where test emails go. */
async function authorize(req: NextRequest): Promise<{ testTo: string } | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return { testTo: LEGAL_EMAIL };
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && isAdminUser(user)) return { testTo: user.email ?? LEGAL_EMAIL };
  return null;
}

/** GET /api/admin/campaigns → { templates, campaigns } with each campaign's stats. */
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: campaigns } = await getSupabaseAdmin().from("campaigns").select("*").order("id", { ascending: false });
  const withStats = await Promise.all((campaigns ?? []).map(async (c) => ({ ...c, stats: await campaignStats(c.id) })));
  const templates = Object.values(CAMPAIGNS).map((c) => ({ slug: c.slug, topic: c.topic, schedule: c.schedule }));
  return NextResponse.json({ templates, campaigns: withStats });
}

/**
 * POST /api/admin/campaigns { action, ... }
 *   create  { slug, holdoutPct? }      draft row for a template in src/lib/campaigns
 *   test    { slug }                   every variant to your own inbox
 *   build   { id, startAt }            freeze the audience and its send times
 *   start   { id } · pause { id, reason? } · resume { id }
 *   sunset  { id, graceDays? }         product news off for permission emails nobody confirmed
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = getSupabaseAdmin();
  const id = Number(body.id);

  const load = async () => {
    const { data } = await sb.from("campaigns").select("*").eq("id", id).maybeSingle<CampaignRow>();
    return data;
  };

  switch (body.action) {
    case "create": {
      const slug = String(body.slug ?? "");
      if (!getCampaignDefinition(slug)) return NextResponse.json({ error: `No template "${slug}"` }, { status: 400 });
      const holdout = Math.min(50, Math.max(0, Number(body.holdoutPct ?? 2)));
      const { data, error } = await sb.from("campaigns").insert({ slug, holdout_pct: holdout, topic: getCampaignDefinition(slug)!.topic }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json(data);
    }

    case "test": {
      const def = getCampaignDefinition(String(body.slug ?? ""));
      if (!def) return NextResponse.json({ error: "No such template" }, { status: 400 });
      const { data: stats } = await sb.from("city_stats").select("total_developers").eq("id", 1).maybeSingle();
      const links = { unsubscribeUrl: `${req.nextUrl.origin}/api/unsubscribe?preview=1`, postalAddress: LEGAL_POSTAL_ADDRESS };
      const variants = [...new Set(def.schedule.map((s) => def.variantFor(s.cohort)))];
      const sent = [];
      for (const variant of variants) {
        const email = def.render(variant, { login: "srizzon", links, confirmUrl: buildConfirmUrl(0, 0), stats: { buildings: stats?.total_developers ?? 0 } });
        const { error } = await sendEmail({ from: FROM_MAIL, to: auth.testTo, subject: `[Test ${variant}] ${email.subject}`, html: email.html, text: email.text });
        sent.push({ variant, error: error?.message ?? null });
      }
      return NextResponse.json({ to: auth.testTo, sent });
    }

    case "build": {
      const campaign = await load();
      if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (campaign.status !== "draft") return NextResponse.json({ error: "Only a draft can be built" }, { status: 400 });
      const startAt = new Date(String(body.startAt ?? ""));
      if (Number.isNaN(startAt.getTime())) return NextResponse.json({ error: "startAt must be an ISO date" }, { status: 400 });
      return NextResponse.json(await buildAudience(id, startAt));
    }

    case "start":
    case "resume": {
      const campaign = await load();
      if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await sb.from("campaigns").update({ status: "sending", pause_reason: null, started_at: campaign.started_at ?? new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ ok: true });
    }

    case "pause": {
      await sb.from("campaigns").update({ status: "paused", pause_reason: String(body.reason ?? "paused by admin") }).eq("id", id);
      return NextResponse.json({ ok: true });
    }

    case "sunset": {
      const turnedOff = await sunsetUnconfirmed(id, Number(body.graceDays ?? 14));
      return NextResponse.json({ turnedOff });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
