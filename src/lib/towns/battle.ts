import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isoDay, weekEnd, weekStart, type TownScore } from "@/lib/leagues/scoring";
import { loadStandings } from "@/lib/leagues/standings";
import { BATTLE_START, RIVALRY } from "./rivalry";
import { SIDES, battlePhase, battleWeekNumber, dayWinners, finishedDays, seriesRecord, weekWinner, type Side } from "./battle-rules";

export interface BattleCoder {
  login: string;
  avatar_url: string | null;
  /** Contributions this week (daily cap applied). */
  total: number;
}

export interface BattleSide {
  /** Null under 3 members coding. */
  perDev: number | null;
  coding: number;
  /** Per dev by day, Mon..Sun. */
  days: number[];
  daysWon: number;
  top: BattleCoder[];
}

export interface BattleState {
  phase: "pick" | "live";
  week: { start: string; end: string };
  /** Who won each day so far, Mon..Sun ("open" = not over yet). */
  dayWinners: (Side | null | "open")[];
  sides: Record<Side, BattleSide>;
  /** The battle week that closed last Monday. Null before the first close. */
  lastWeek: { start: string; number: number; winner: Side | null; claude: TownScore | null; codex: TownScore | null } | null;
  series: Record<Side, number>;
}

const TOP = 3;

interface WeekLoad {
  sides: Record<Side, Omit<BattleSide, "daysWon">>;
  closed: { start: string; claude: TownScore | null; codex: TownScore | null }[];
}

async function rivalryIds(): Promise<Record<Side, string | null>> {
  const { data, error } = await getSupabaseAdmin()
    .from("leagues")
    .select("id, slug")
    .in("slug", RIVALRY.map((r) => r.slug));
  if (error) throw error;
  const id = (i: 0 | 1) => (data ?? []).find((l) => l.slug === RIVALRY[i].slug)?.id ?? null;
  return { claude: id(0), codex: id(1) };
}

async function loadWeek(startDay: string): Promise<WeekLoad> {
  const ids = await rivalryIds();
  const refs = SIDES.flatMap((s) => (ids[s] ? [{ id: ids[s] as string }] : []));
  const standings = await loadStandings(refs, new Date(`${startDay}T00:00:00Z`));

  const side = (s: Side): Omit<BattleSide, "daysWon"> => {
    const w = ids[s] ? standings.get(ids[s] as string) : undefined;
    return {
      perDev: w?.town?.perDev ?? null,
      coding: w?.town?.coding ?? w?.standings.filter((e) => e.total > 0).length ?? 0,
      days: w?.days ?? [0, 0, 0, 0, 0, 0, 0],
      top: (w?.standings ?? [])
        .filter((e) => e.total > 0)
        .slice(0, TOP)
        .map((e) => ({ login: e.login, avatar_url: e.avatar_url, total: e.total })),
    };
  };

  // Closed battle weeks, frozen by the Monday close (league_weeks).
  const { data: rows, error } = await getSupabaseAdmin()
    .from("league_weeks")
    .select("league_id, week_start, standings")
    .in("league_id", refs.map((r) => r.id))
    .gte("week_start", isoDay(new Date(BATTLE_START)))
    .lt("week_start", startDay)
    .order("week_start");
  if (error) throw error;
  const byWeek = new Map<string, { claude: TownScore | null; codex: TownScore | null }>();
  for (const r of rows ?? []) {
    const s: Side = r.league_id === ids.claude ? "claude" : "codex";
    const entry = byWeek.get(r.week_start as string) ?? { claude: null, codex: null };
    entry[s] = (r.standings as { town?: TownScore | null } | null)?.town ?? null;
    byWeek.set(r.week_start as string, entry);
  }

  return {
    sides: { claude: side("claude"), codex: side("codex") },
    closed: [...byWeek.entries()].map(([start, w]) => ({ start, ...w })),
  };
}

// The hourly stats job moves the numbers; 5 minutes is fresh enough.
const cachedWeek = unstable_cache(loadWeek, ["towns-battle-v1"], { revalidate: 300 });

/** Claude vs Codex right now: this week's score and days, last week's result, the series. */
export async function getBattleState(now: Date = new Date()): Promise<BattleState> {
  const start = weekStart(now);
  const load = await cachedWeek(isoDay(start));
  const winners = dayWinners(load.sides.claude.days, load.sides.codex.days, finishedDays(start, now.getTime()));
  const won = (s: Side) => winners.filter((w) => w === s).length;

  const closed = load.closed.map((w) => ({ ...w, winner: weekWinner(w.claude, w.codex) }));
  const prev = new Date(start);
  prev.setUTCDate(prev.getUTCDate() - 7);
  const found = closed.find((w) => w.start === isoDay(prev));
  const last = found ? { ...found, number: battleWeekNumber(found.start) } : null;

  return {
    phase: battlePhase(now.getTime()),
    week: { start: isoDay(start), end: isoDay(weekEnd(start)) },
    dayWinners: winners,
    sides: {
      claude: { ...load.sides.claude, daysWon: won("claude") },
      codex: { ...load.sides.codex, daysWon: won("codex") },
    },
    lastWeek: last,
    series: seriesRecord(closed.map((w) => w.winner)),
  };
}
