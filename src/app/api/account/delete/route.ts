import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CLAIMED_DEVELOPER_LIMIT, pickClaimedDeveloper } from "@/lib/auth-identity";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Find the developer record claimed by this auth user
  const { data: devRows, error: devErr } = await admin
    .from("developers")
    .select("id, github_login")
    .eq("claimed_by", user.id)
    .order("claimed_at", { ascending: true })
    .limit(CLAIMED_DEVELOPER_LIMIT);
  const dev = pickClaimedDeveloper(devRows, user);

  if (devErr || !dev) {
    // No claimed building — just delete the auth user
    await admin.auth.admin.deleteUser(user.id);
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  const devId = dev.id;
  const githubLoginForPh: string = dev.github_login;

  // Tables whose foreign keys to developers don't cascade, so they must be
  // emptied before the developer row can go. Each step runs after the one
  // before it; any failure stops before the building or login is deleted.
  const devOr = (a: string, b: string) => `${a}.eq.${devId},${b}.eq.${devId}`;
  const steps: { label: string; run: () => PromiseLike<{ error: unknown }> }[] = [
    { label: "activity_feed", run: () => admin.from("activity_feed").delete().or(devOr("actor_id", "target_id")) },
    { label: "xp_log", run: () => admin.from("xp_log").delete().eq("developer_id", devId) },
    { label: "daily_mission_progress", run: () => admin.from("daily_mission_progress").delete().eq("developer_id", devId) },
    { label: "fly_scores", run: () => admin.from("fly_scores").delete().eq("developer_id", devId) },
    { label: "streak_freeze_log", run: () => admin.from("streak_freeze_log").delete().eq("developer_id", devId) },
    { label: "streak_checkins", run: () => admin.from("streak_checkins").delete().eq("developer_id", devId) },
    { label: "streak_rewards", run: () => admin.from("streak_rewards").delete().eq("developer_id", devId) },
    { label: "developer_kudos", run: () => admin.from("developer_kudos").delete().or(devOr("giver_id", "receiver_id")) },
    { label: "building_visits", run: () => admin.from("building_visits").delete().or(devOr("visitor_id", "building_id")) },
    { label: "developer_achievements", run: () => admin.from("developer_achievements").delete().eq("developer_id", devId) },
    { label: "developer_customizations", run: () => admin.from("developer_customizations").delete().eq("developer_id", devId) },
    { label: "survey_responses", run: () => admin.from("survey_responses").delete().eq("developer_id", devId) },
    { label: "district_changes", run: () => admin.from("district_changes").delete().eq("developer_id", devId) },
    { label: "districts", run: () => admin.from("districts").update({ mayor_id: null }).eq("mayor_id", devId) },
    { label: "purchases", run: () => admin.from("purchases").delete().eq("developer_id", devId) },
    // Null out gifted_to references from other users' purchases pointing to this dev
    { label: "purchases.gifted_to", run: () => admin.from("purchases").update({ gifted_to: null }).eq("gifted_to", devId) },
    // pixel_gitc_payments cascades from pixel_purchases but also points at the dev
    { label: "pixel_gitc_payments", run: () => admin.from("pixel_gitc_payments").delete().eq("developer_id", devId) },
    { label: "pixel_purchases", run: () => admin.from("pixel_purchases").delete().eq("developer_id", devId) },
    { label: "wallet_transactions", run: () => admin.from("wallet_transactions").delete().eq("developer_id", devId) },
    { label: "wallets", run: () => admin.from("wallets").delete().eq("developer_id", devId) },
    // Raid tags reference raids, so they go first
    { label: "raid_tags", run: () => admin.from("raid_tags").delete().or(devOr("building_id", "attacker_id")) },
    { label: "raids", run: () => admin.from("raids").delete().or(devOr("attacker_id", "defender_id")) },
    { label: "arcade_rooms", run: () => admin.from("arcade_rooms").delete().eq("owner_id", user.id) },
    { label: "sky_ad_events", run: () => admin.from("sky_ad_events").delete().ilike("github_login", githubLoginForPh) },
    // Removes the building from the city; the remaining tables cascade or set null
    { label: "developers", run: () => admin.from("developers").delete().eq("id", devId) },
  ];

  for (const step of steps) {
    const { error } = await step.run();
    if (error) {
      console.error(`[account/delete] ${step.label} failed for developer ${devId}`, error);
      return NextResponse.json(
        { error: "Couldn't delete your account. Try again or email us." },
        { status: 500 },
      );
    }
  }

  if (githubLoginForPh) {
    const phDelete = getPostHogClient();
    phDelete.capture({
      distinctId: githubLoginForPh,
      event: "account_deleted",
      properties: { developer_id: devId },
    });
    await phDelete.shutdown();
  }

  // Delete the auth user
  await admin.auth.admin.deleteUser(user.id);

  // Sign out the session
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
