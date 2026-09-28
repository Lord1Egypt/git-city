import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CLAIMED_DEVELOPER_LIMIT, pickClaimedDeveloper } from "@/lib/auth-identity";
import { recordConsent } from "@/lib/consent";
import { readPreferences, updatePreferences } from "@/lib/email/preferences";

// The one-time notice that Git City emails product news: the opt-out offered
// when we start using the address for it (EU soft opt-in, and Gmail's
// "people should expect your email"). Shown once per player.

async function currentDeveloperId(): Promise<number | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: devRows } = await getSupabaseAdmin()
    .from("developers")
    .select("id, github_login")
    .eq("claimed_by", user.id)
    .order("claimed_at", { ascending: true })
    .limit(CLAIMED_DEVELOPER_LIMIT);
  return pickClaimedDeveloper(devRows, user)?.id ?? null;
}

/** GET → { show } for the signed-in player. */
export async function GET() {
  const devId = await currentDeveloperId();
  if (!devId) return NextResponse.json({ show: false });

  const [{ count }, prefs] = await Promise.all([
    getSupabaseAdmin().from("consent_events").select("id", { count: "exact", head: true }).eq("developer_id", devId).eq("action", "notice_shown"),
    readPreferences(devId),
  ]);
  const show = !count && prefs?.email_enabled !== false && prefs?.product_news !== false;
  return NextResponse.json({ show });
}

/** POST { choice: "keep" | "no" } → records the answer; "no" turns product news off. */
export async function POST(request: Request) {
  const devId = await currentDeveloperId();
  if (!devId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { choice } = (await request.json().catch(() => ({}))) as { choice?: string };

  await recordConsent({ developerId: devId, topic: "product_news", action: "notice_shown", source: "notice" });
  if (choice === "no") {
    const { error } = await updatePreferences(devId, { product_news: false }, "notice");
    if (error) return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
