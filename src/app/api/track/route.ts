import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CLAIMED_DEVELOPER_LIMIT, pickClaimedDeveloper } from "@/lib/auth-identity";
import { rateLimit } from "@/lib/rate-limit";
import { captureServer } from "@/lib/posthog-server";

// Client → PostHog (server side) for a small allowlist of client-side events
// (raid_viewed, raid_joined, reward_claimed, sponsor_clicked). The signed-in
// login is the person; signed out, the anonymous id. Rate-limited.

const ALLOWED_EVENTS = new Set([
  "raid_viewed",
  "raid_joined",
  "reward_claimed",
  "sponsor_impression",
  "sponsor_clicked",
]);

export async function POST(request: Request) {
  let body: { event_name?: unknown; props?: unknown; anonymous_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventName = typeof body.event_name === "string" ? body.event_name : "";
  if (!ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ ok: false, reason: "event_not_allowed" }, { status: 400 });
  }

  const props = (body.props && typeof body.props === "object" ? body.props : {}) as Record<string, unknown>;
  const anonymousId = typeof body.anonymous_id === "string" ? body.anonymous_id : null;

  // Resolve the login from the session if logged in
  let login: string | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const rl = rateLimit(`track:${user.id}`, 10, 1000);
      if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });
      const admin = getSupabaseAdmin();
      const { data: rows } = await admin
        .from("developers")
        .select("id, github_login")
        .eq("claimed_by", user.id)
        .order("claimed_at", { ascending: true })
        .limit(CLAIMED_DEVELOPER_LIMIT);
      const dev = pickClaimedDeveloper(rows, user);
      login = dev?.github_login?.toLowerCase() ?? null;
    } else if (anonymousId) {
      const rl = rateLimit(`track:anon:${anonymousId}`, 10, 1000);
      if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });
    }
  } catch { /* ignore — fall through to log with whatever we have */ }

  const distinctId = login ?? anonymousId;
  if (distinctId) await captureServer(distinctId, eventName, login ? props : { ...props, $process_person_profile: false });
  return NextResponse.json({ ok: true });
}
