import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  isoDay,
  rankStandings,
  dayContributions,
  townDays,
  townScore,
  weekContributions,
  weekDays,
  type ContributionDay,
  type Standing,
  type StandingInput,
  type TownScore,
} from "./scoring";

export interface LeagueStandingEntry extends StandingInput {
  login: string;
  avatar_url: string | null;
  /** Contributions per day, Mon..Sun (capped). */
  days: number[];
}

export interface LeagueWeekStandings {
  leagueId: string;
  weekStart: string; // YYYY-MM-DD
  standings: Standing<LeagueStandingEntry>[];
  /** The town's score against other towns. Null under 3 members coding. */
  town: TownScore | null;
  /** Per dev by day, Mon..Sun: the town's contribution graph. */
  days: number[];
}

interface LeagueRef {
  id: string;
}

const PAGE = 1000;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Compute the week's standings for several leagues at once. Members and
 * contribution days are loaded once for the union of active members.
 */
export async function loadStandings(
  leagues: LeagueRef[],
  start: Date,
  sb: SupabaseClient = getSupabaseAdmin(),
): Promise<Map<string, LeagueWeekStandings>> {
  const result = new Map<string, LeagueWeekStandings>();
  if (leagues.length === 0) return result;

  const startDay = isoDay(start);
  const week = weekDays(start);

  type MemberRow = {
    league_id: string;
    developer_id: number;
    joined_at: string | null;
    developers: { github_login: string; avatar_url: string | null } | null;
  };
  const members: MemberRow[] = [];
  for (const ids of chunk(leagues.map((l) => l.id), 200)) {
    const rows = await fetchAll<MemberRow>((from, to) =>
      sb
        .from("league_members")
        .select("league_id, developer_id, joined_at, developers!league_members_developer_id_fkey(github_login, avatar_url)")
        .in("league_id", ids)
        .eq("status", "active")
        .order("developer_id")
        .range(from, to)
        .returns<MemberRow[]>(),
    );
    members.push(...rows);
  }

  const devIds = [...new Set(members.map((m) => m.developer_id))];
  const daysByDev = new Map<number, ContributionDay[]>();

  for (const ids of chunk(devIds, 200)) {
    const dayRows = await fetchAll<{ developer_id: number; day: string; contributions: number }>((from, to) =>
      sb
        .from("league_weekly_stats")
        .select("developer_id, day, contributions")
        .in("developer_id", ids)
        .eq("week_start", startDay)
        .order("developer_id")
        .range(from, to),
    );
    for (const r of dayRows) {
      const list = daysByDev.get(r.developer_id) ?? [];
      list.push({ day: r.day, contributions: r.contributions });
      daysByDev.set(r.developer_id, list);
    }
  }

  for (const league of leagues) {
    const own = members.filter((m) => m.league_id === league.id);
    const entries: LeagueStandingEntry[] = own.map((m) => ({
      developer_id: m.developer_id,
      joined_at: m.joined_at,
      login: m.developers?.github_login ?? String(m.developer_id),
      avatar_url: m.developers?.avatar_url ?? null,
      total: weekContributions(daysByDev.get(m.developer_id) ?? []),
      days: dayContributions(daysByDev.get(m.developer_id) ?? [], week),
    }));
    result.set(league.id, {
      leagueId: league.id,
      weekStart: startDay,
      standings: rankStandings(entries),
      town: townScore(entries.map((e) => e.total)),
      days: townDays(entries.map((e) => e.days)),
    });
  }

  return result;
}

export async function loadLeagueStandings(
  league: LeagueRef,
  start: Date,
  sb: SupabaseClient = getSupabaseAdmin(),
): Promise<LeagueWeekStandings> {
  const map = await loadStandings([league], start, sb);
  return map.get(league.id)!;
}
