import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runCampaign, type CampaignRow } from "@/lib/campaigns";

export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000;
const PER_RUN_LIMIT = 1500;

/**
 * Cron: every 5 minutes. Sends the due recipients of every campaign in
 * "sending"; each run checks the campaign's circuit breaker first.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const { data: campaigns } = await getSupabaseAdmin().from("campaigns").select("*").eq("status", "sending");
  const results: Record<string, unknown> = {};
  for (const campaign of (campaigns ?? []) as CampaignRow[]) {
    if (Date.now() > deadline) break;
    results[campaign.slug] = await runCampaign(campaign, { limit: PER_RUN_LIMIT, deadline });
  }
  return NextResponse.json({ ok: true, results });
}
