import { NextRequest, NextResponse } from "next/server";
import { weekStart } from "@/lib/leagues/scoring";
import { closeWeek } from "@/lib/leagues/close";
import { sendLeagueWeeklyResults } from "@/lib/notification-senders/league-weekly";
import { closeTownWeek, type TownWeekResult } from "@/lib/towns/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Monday week close ───────────────────────────────────────────────────────
// Runs Monday 00:05 UTC and closes the week that just ended. `?week=YYYY-MM-DD`
// closes another week (staging tests: pass the current Monday).

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const param = request.nextUrl.searchParams.get("week");
  let start: Date;
  if (param) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(param)) return NextResponse.json({ error: "Bad week" }, { status: 400 });
    start = weekStart(new Date(`${param}T12:00:00Z`));
  } else {
    start = weekStart(new Date());
    start.setUTCDate(start.getUTCDate() - 7);
  }

  try {
    const { closed, errors, ranked } = await closeWeek(start);

    // Visits rollup and Town of the week, before the emails so they can name
    // the winner. A failure here doesn't undo the race.
    let towns: TownWeekResult | { error: string };
    try {
      towns = await closeTownWeek(start, ranked);
    } catch (err) {
      console.error("[league-close] town week:", err);
      towns = { error: String(err) };
    }
    const townOfWeek = "featured" in towns ? towns.featured : null;

    // Results emails (awaited).
    let emailed = 0;
    for (const c of closed) {
      try {
        emailed += await sendLeagueWeeklyResults(c, townOfWeek);
      } catch (err) {
        console.error(`[league-close] emails for ${c.league.slug}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      towns,
      week_start: start.toISOString().slice(0, 10),
      closed: closed.length,
      winners: closed.filter((c) => c.winnerId).length,
      errors,
      emailed,
    });
  } catch (err) {
    console.error("[league-close]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
