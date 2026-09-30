import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isoDay, townDays, weekEnd, weekStart, type TownScore } from "@/lib/leagues/scoring";
import { loadStandings } from "@/lib/leagues/standings";
import { BATTLE_START, RIVALRY } from "./rivalry";
import { leagueAssetUrl } from "@/lib/league-city/identity";
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
  /** "result" all Monday (UTC) once last week closed: the sides show that week's final. */
  showing: "live" | "result";
  /** The week the sides show. `number` 1 is the week starting BATTLE_START. */
  week: { start: string; end: string; number: number };
  /** The week that runs now (ends Sunday night): the countdown. */
  current: { start: string; end: string; number: number };
  /** Who won each day, Mon..Sun ("open" = not over yet). */
  dayWinners: (Side | null | "open")[];
  sides: Record<Side, BattleSide>;
  /** The battle week that closed last Monday. Null before the first close. */
  lastWeek: { start: string; number: number; winner: Side | null; claude: TownScore | null; codex: TownScore | null } | null;
  series: Record<Side, number>;
}

const TOP = 3;
const NO_DAYS = [0, 0, 0, 0, 0, 0, 0];

type SideLoad = Omit<BattleSide, "daysWon">;

interface WeekLoad {
  live: Record<Side, SideLoad>;
  closed: { start: string; claude: TownScore | null; codex: TownScore | null }[];
  /** The last closed week as frozen by the close, for the Monday result. */
  prev: Record<Side, SideLoad> | null;
}

/** A standings entry as league_weeks freezes it (STANDINGS_VERSION 2). */
interface FrozenEntry {
  login: string;
  avatar_url: string | null;
  total: number;
  days?: number[];
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

function sideOf(town: TownScore | null, entries: FrozenEntry[], days: number[]): SideLoad {
  return {
    perDev: town?.perDev ?? null,
    coding: town?.coding ?? entries.filter((e) => e.total > 0).length,
    days,
    top: entries
      .filter((e) => e.total > 0)
      .slice(0, TOP)
      .map((e) => ({ login: e.login, avatar_url: e.avatar_url, total: e.total })),
  };
}

async function loadWeek(startDay: string): Promise<WeekLoad> {
  const ids = await rivalryIds();
  const refs = SIDES.flatMap((s) => (ids[s] ? [{ id: ids[s] as string }] : []));
  const standings = await loadStandings(refs, new Date(`${startDay}T00:00:00Z`));
  const live = (s: Side): SideLoad => {
    const w = ids[s] ? standings.get(ids[s] as string) : undefined;
    return sideOf(w?.town ?? null, w?.standings ?? [], w?.days ?? NO_DAYS);
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
  type Frozen = { town?: TownScore | null; standings?: FrozenEntry[] } | null;
  const byWeek = new Map<string, Record<Side, Frozen>>();
  for (const r of rows ?? []) {
    const s: Side = r.league_id === ids.claude ? "claude" : "codex";
    const entry = byWeek.get(r.week_start as string) ?? { claude: null, codex: null };
    entry[s] = r.standings as Frozen;
    byWeek.set(r.week_start as string, entry);
  }

  const prevStart = new Date(`${startDay}T00:00:00Z`);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prev = byWeek.get(isoDay(prevStart));
  const frozenSide = (f: Frozen): SideLoad => {
    const entries = f?.standings ?? [];
    return sideOf(f?.town ?? null, entries, townDays(entries.map((e) => e.days ?? NO_DAYS)));
  };

  return {
    live: { claude: live("claude"), codex: live("codex") },
    closed: [...byWeek.entries()].map(([start, w]) => ({ start, claude: w.claude?.town ?? null, codex: w.codex?.town ?? null })),
    prev: prev ? { claude: frozenSide(prev.claude), codex: frozenSide(prev.codex) } : null,
  };
}

// The hourly stats job moves the numbers; 5 minutes is fresh enough.
const cachedWeek = unstable_cache(loadWeek, ["towns-battle-v2"], { revalidate: 300 });

/** Claude vs Codex right now: this week's score and days (last week's final on Mondays), last week's result, the series. */
export async function getBattleState(now: Date = new Date()): Promise<BattleState> {
  const start = weekStart(now);
  const load = await cachedWeek(isoDay(start));

  const closed = load.closed.map((w) => ({ ...w, winner: weekWinner(w.claude, w.codex) }));
  const prev = new Date(start);
  prev.setUTCDate(prev.getUTCDate() - 7);
  const found = closed.find((w) => w.start === isoDay(prev));
  const last = found ? { ...found, number: battleWeekNumber(found.start) } : null;

  const result = !!last && !!load.prev && now.getUTCDay() === 1;
  const shown = result ? prev : start;
  const sides = result ? (load.prev as Record<Side, SideLoad>) : load.live;
  const winners = dayWinners(sides.claude.days, sides.codex.days, result ? 7 : finishedDays(start, now.getTime()));
  const won = (s: Side) => winners.filter((w) => w === s).length;
  const span = (d: Date) => ({ start: isoDay(d), end: isoDay(weekEnd(d)), number: battleWeekNumber(isoDay(d)) });

  return {
    phase: battlePhase(now.getTime()),
    showing: result ? "result" : "live",
    week: span(shown),
    current: span(start),
    dayWinners: winners,
    sides: {
      claude: { ...sides.claude, daysWon: won("claude") },
      codex: { ...sides.codex, daysWon: won("codex") },
    },
    lastWeek: last,
    series: seriesRecord(closed.map((w) => w.winner)),
  };
}

/** A closed battle week as the Monday close froze it. Null when it isn't closed (or isn't a battle week). */
export async function getWeekResult(startDay: string): Promise<{ winner: Side | null; claude: TownScore | null; codex: TownScore | null } | null> {
  if (Date.parse(`${startDay}T00:00:00Z`) < BATTLE_START) return null;
  const ids = await rivalryIds();
  const { data, error } = await getSupabaseAdmin()
    .from("league_weeks")
    .select("league_id, standings")
    .in("league_id", SIDES.flatMap((s) => (ids[s] ? [ids[s] as string] : [])))
    .eq("week_start", startDay);
  if (error) throw error;
  if (!data?.length) return null;
  const town = (s: Side) => ((data.find((r) => r.league_id === ids[s])?.standings as { town?: TownScore | null } | null)?.town ?? null);
  const [claude, codex] = [town("claude"), town("codex")];
  return { winner: weekWinner(claude, codex), claude, codex };
}

/** Each rivalry town's logo (its active league_assets logo), for the battle images. */
export async function getRivalryLogos(): Promise<Record<Side, string | null>> {
  const ids = await rivalryIds();
  const { data, error } = await getSupabaseAdmin()
    .from("league_cities")
    .select("league_id, logo:league_assets!league_cities_logo_asset_id_fkey(path, status)")
    .in("league_id", SIDES.flatMap((s) => (ids[s] ? [ids[s] as string] : [])))
    .returns<{ league_id: string; logo: { path: string; status: string } | null }[]>();
  if (error) throw error;
  const logo = (s: Side) => {
    const l = data?.find((r) => r.league_id === ids[s])?.logo;
    return l?.status === "active" ? leagueAssetUrl(l.path) : null;
  };
  return { claude: logo("claude"), codex: logo("codex") };
}
