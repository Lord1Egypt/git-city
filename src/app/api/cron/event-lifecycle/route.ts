import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { captureServer } from "@/lib/posthog-server";

// System events belong to no player: no person profile.
const SYSTEM = { distinctId: "event-lifecycle", props: { $process_person_profile: false } };

// Runs every minute. Transitions events by their scheduled time window:
//   scheduled → live   (at starts_at)
//   live      → wrap → archived  (at ends_at, distributing rewards)
//
// Outcome is inferred from total_damage vs boss_max_hp (PartyKit holds the
// real-time HP; the DB sees the accumulated credited damage).

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const results = { opened: 0, closed: 0, errors: 0 };

  // ─── Open scheduled events whose start time has passed ──────
  try {
    const { data: toOpen } = await sb
      .from("event_instances")
      .select("id, slug")
      .eq("status", "scheduled")
      .lte("starts_at", now);

    for (const ev of toOpen ?? []) {
      const { error } = await sb
        .from("event_instances")
        .update({ status: "live" })
        .eq("id", ev.id)
        .eq("status", "scheduled"); // guard against double-open
      if (error) {
        results.errors++;
      } else {
        results.opened++;
      }
    }
  } catch (err) {
    console.error("[event-lifecycle] open error", err);
    results.errors++;
  }

  // ─── Close live events whose end time has passed ────────────
  try {
    const { data: toClose } = await sb
      .from("event_instances")
      .select("id, slug")
      .eq("status", "live")
      .lte("ends_at", now);

    for (const ev of toClose ?? []) {
      try {
        // Move to wrap (guard against double-close). complete_event_wrap
        // computes total_damage, outcome, ranks, rewards, and archives.
        await sb
          .from("event_instances")
          .update({ status: "wrap" })
          .eq("id", ev.id)
          .eq("status", "live");
        const { data: wrapData, error: wrapErr } = await sb.rpc("complete_event_wrap", { p_event_id: ev.id });
        if (wrapErr) {
          results.errors++;
          console.error(`[event-lifecycle] wrap failed for ${ev.slug}`, wrapErr);
        } else {
          results.closed++;
          const outcome = (wrapData as { outcome?: string } | null)?.outcome ?? "unknown";
          const participants = (wrapData as { participants?: number } | null)?.participants ?? 0;
          await captureServer(SYSTEM.distinctId, "event_wrapped", { ...SYSTEM.props, event_id: ev.id, slug: ev.slug, outcome, participants });
          if (outcome === "victory") {
            await captureServer(SYSTEM.distinctId, "boss_defeated", { ...SYSTEM.props, event_id: ev.id, slug: ev.slug, participants });
          }
        }
      } catch (err) {
        results.errors++;
        console.error(`[event-lifecycle] close error for ${ev.slug}`, err);
      }
    }
  } catch (err) {
    console.error("[event-lifecycle] close query error", err);
    results.errors++;
  }

  return NextResponse.json({ ok: true, ...results });
}
