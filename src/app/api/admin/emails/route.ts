import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdminUser } from "@/lib/auth-identity";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface DeliveryCounts {
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

export interface EmailsOverview {
  days: number;
  totals: DeliveryCounts;
  byType: Record<string, DeliveryCounts>;
  daily: { date: string; delivered: number; pending: number; problems: number }[];
  suppressions: { bounce: number; complaint: number; recent: number };
  unsubscribes: { topic: string; count: number }[];
}

const empty = (): DeliveryCounts => ({ sent: 0, failed: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 });

/**
 * GET /api/admin/emails?days=7|30
 * Delivery health for every engine email: totals, per type, per day, plus
 * suppressions and unsubscribes by topic. Admin only.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = req.nextUrl.searchParams.get("days") === "7" ? 7 : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const sb = getSupabaseAdmin();

  const totals = empty();
  const byType: Record<string, DeliveryCounts> = {};
  const dailyMap = new Map<string, { delivered: number; pending: number; problems: number }>();
  for (let i = days - 1; i >= 0; i--) {
    dailyMap.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), { delivered: 0, pending: 0, problems: 0 });
  }

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("notification_log")
      .select("notification_type, status, created_at, delivered_at, opened_at, clicked_at")
      .eq("channel", "email")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;

    for (const row of data) {
      const t = (byType[row.notification_type] ??= empty());
      const day = dailyMap.get(String(row.created_at).slice(0, 10));
      const bump = (key: keyof DeliveryCounts) => {
        totals[key]++;
        t[key]++;
      };
      if (row.status === "failed") {
        bump("failed");
        if (day) day.problems++;
        continue;
      }
      bump("sent");
      if (row.delivered_at) bump("delivered");
      if (row.opened_at) bump("opened");
      if (row.clicked_at) bump("clicked");
      if (row.status === "bounced") bump("bounced");
      if (row.status === "complained") bump("complained");
      if (day) {
        if (row.status === "bounced" || row.status === "complained") day.problems++;
        else if (row.delivered_at) day.delivered++;
        else day.pending++;
      }
    }
    if (data.length < PAGE) break;
  }

  const [{ data: suppressionRows }, { data: consentRows }] = await Promise.all([
    sb.from("notification_suppressions").select("reason, created_at").eq("channel", "email"),
    sb.from("consent_events").select("topic").eq("action", "unsubscribed").gte("created_at", since.toISOString()),
  ]);
  const suppressions = { bounce: 0, complaint: 0, recent: 0 };
  for (const s of suppressionRows ?? []) {
    if (s.reason === "complaint") suppressions.complaint++;
    else suppressions.bounce++;
    if (s.created_at && new Date(s.created_at) >= since) suppressions.recent++;
  }
  const unsubCounts = new Map<string, number>();
  for (const c of consentRows ?? []) unsubCounts.set(c.topic, (unsubCounts.get(c.topic) ?? 0) + 1);

  const overview: EmailsOverview = {
    days,
    totals,
    byType,
    daily: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
    suppressions,
    unsubscribes: [...unsubCounts.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count),
  };
  return NextResponse.json(overview);
}
