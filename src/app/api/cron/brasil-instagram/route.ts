import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { refreshInstagramToken } from "@/lib/instagram";
import { syncBrasilReels } from "@/lib/towns/brasil-instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Every 10 minutes: the Brasil reels' comments ───────────────────────────
// - Reads the watched reels' comments and imports any the webhook missed.
// - Refreshes the Instagram token once a week (it lasts 60 days).
// Nothing connected: nothing to do.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: account } = await getSupabaseAdmin()
    .from("instagram_account")
    .select("ig_user_id, refreshed_at")
    .eq("id", 1)
    .maybeSingle<{ ig_user_id: string | null; refreshed_at: string }>();
  if (!account) return NextResponse.json({ ok: true, skipped: "not connected" });

  let refreshed: string | null = null;
  if (Date.now() - new Date(account.refreshed_at).getTime() > 7 * 86_400_000) {
    try {
      refreshed = (await refreshInstagramToken()).expiresAt;
    } catch (err) {
      console.error("[cron] instagram refresh", err);
    }
  }
  try {
    return NextResponse.json({ ok: true, refreshed, ...(await syncBrasilReels(account.ig_user_id)) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
