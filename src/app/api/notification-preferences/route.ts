import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CLAIMED_DEVELOPER_LIMIT, pickClaimedDeveloper } from "@/lib/auth-identity";
import { updatePreferences } from "@/lib/email/preferences";


/**
 * GET /api/notification-preferences
 * Returns the authenticated user's notification preferences.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  const { data: devRows } = await sb
    .from("developers")
    .select("id, github_login")
    .eq("claimed_by", user.id)
    .order("claimed_at", { ascending: true })
    .limit(CLAIMED_DEVELOPER_LIMIT);
  const dev = pickClaimedDeveloper(devRows, user);

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  const { data: prefs } = await sb
    .from("notification_preferences")
    .select("*")
    .eq("developer_id", dev.id)
    .maybeSingle();

  // Return defaults if no row exists
  if (!prefs) {
    return NextResponse.json({
      email_enabled: true,
      push_enabled: true,
      transactional: true,
      social: true,
      digest: true,
      marketing: false,
      product_news: true,
      streak_reminders: true,
      leagues: true,
      digest_frequency: "realtime",
      quiet_hours_start: null,
      quiet_hours_end: null,
      channel_overrides: {},
    });
  }

  return NextResponse.json(prefs);
}

/**
 * PATCH /api/notification-preferences
 * Update authenticated user's notification preferences.
 * `transactional` cannot be disabled (purchase receipts always send).
 */
export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const sb = getSupabaseAdmin();

  const { data: devRows } = await sb
    .from("developers")
    .select("id, github_login")
    .eq("claimed_by", user.id)
    .order("claimed_at", { ascending: true })
    .limit(CLAIMED_DEVELOPER_LIMIT);
  const dev = pickClaimedDeveloper(devRows, user);

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  const { row, error } = await updatePreferences(dev.id, body, "settings");
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(row);
}
