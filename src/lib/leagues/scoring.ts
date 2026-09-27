// ─── League scoring (pure) ──────────────────────────────────
// The week runs Monday 00:00 UTC → Sunday 23:59:59 UTC. Only active members
// score. A dev's score is their GitHub contributions, each day capped. A
// town's score is the average of the members who coded that week. Everything
// here is pure so it can be unit-tested; standings.ts loads the rows.

/** Stops a commit bot from winning a week alone. */
export const DAILY_CONTRIBUTION_CAP = 100;
/** A town needs this many members who coded that week to be ranked. */
export const TOWN_MIN_CODERS = 3;
/** league_weeks.standings shape since contributions scoring. Older rows (points) have no version. */
export const STANDINGS_VERSION = 2;

export interface ContributionDay {
  day: string; // YYYY-MM-DD (UTC)
  contributions: number;
}

// ─── Week boundaries ────────────────────────────────────────

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d;
}

/** Monday 00:00 UTC of the following week (exclusive end). */
export function weekEnd(start: Date): Date {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

/** YYYY-MM-DD for a UTC date. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The 7 YYYY-MM-DD days of the week starting at `start`. */
export function weekDays(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return isoDay(d);
  });
}

// ─── Scores ─────────────────────────────────────────────────

/** The week's GitHub contributions, each day capped at DAILY_CONTRIBUTION_CAP. */
export function weekContributions(days: ContributionDay[]): number {
  let total = 0;
  for (const d of days) total += Math.min(Math.max(0, Math.floor(d.contributions)), DAILY_CONTRIBUTION_CAP);
  return total;
}

/** Contributions per day of the week (Mon..Sun), each capped; days without data are 0. */
export function dayContributions(days: ContributionDay[], week: string[]): number[] {
  const out = week.map(() => 0);
  for (const d of days) {
    const i = week.indexOf(d.day);
    if (i >= 0) out[i] = Math.min(Math.max(0, Math.floor(d.contributions)), DAILY_CONTRIBUTION_CAP);
  }
  return out;
}

/** A town's day graph: each day's total over the members who coded that week. */
export function townDays(memberDays: number[][]): number[] {
  const coders = memberDays.filter((d) => d.some((n) => n > 0));
  const n = Math.max(coders.length, 1);
  return Array.from({ length: 7 }, (_, i) => Math.round(coders.reduce((a, d) => a + (d[i] ?? 0), 0) / n));
}

export interface TownScore {
  /** Average contributions of the members who coded, rounded. */
  perDev: number;
  /** Members with 1+ contribution this week. */
  coding: number;
}

/**
 * A town's week: the average of its members who coded, so inviting someone
 * never lowers it and size doesn't win by itself. Null under TOWN_MIN_CODERS.
 */
export function townScore(memberTotals: number[]): TownScore | null {
  const coders = memberTotals.filter((t) => t > 0);
  if (coders.length < TOWN_MIN_CODERS) return null;
  const sum = coders.reduce((a, b) => a + b, 0);
  return { perDev: Math.round(sum / coders.length), coding: coders.length };
}

export interface RankableTown {
  id: string;
  created_at: string | null;
  score: TownScore | null;
}

/**
 * Ranked towns only (null scores dropped), best first. Ties: more members
 * coding, then the older town, then id.
 */
export function rankTowns<T extends RankableTown>(towns: T[]): (T & { score: TownScore; rank: number })[] {
  const created = (t: T) => (t.created_at ? Date.parse(t.created_at) : Number.MAX_SAFE_INTEGER);
  return towns
    .filter((t): t is T & { score: TownScore } => t.score !== null)
    .sort(
      (a, b) =>
        b.score.perDev - a.score.perDev ||
        b.score.coding - a.score.coding ||
        created(a) - created(b) ||
        a.id.localeCompare(b.id),
    )
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

// ─── Standings ──────────────────────────────────────────────

export interface StandingInput {
  developer_id: number;
  /** Contributions this week (daily cap applied). */
  total: number;
  joined_at: string | null;
}

export type Standing<T extends StandingInput = StandingInput> = T & { rank: number };

/**
 * Sort by total desc. Ties: earlier joined_at, then developer id.
 * Ranks are 1-based and unique (the tie-break always resolves).
 */
export function rankStandings<T extends StandingInput>(entries: T[]): Standing<T>[] {
  const joined = (e: T) => (e.joined_at ? Date.parse(e.joined_at) : Number.MAX_SAFE_INTEGER);
  return [...entries]
    .sort(
      (a, b) =>
        b.total - a.total ||
        joined(a) - joined(b) ||
        a.developer_id - b.developer_id,
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ─── Overtakes ──────────────────────────────────────────────

export interface Overtake {
  developerId: number;
  overtakerLogin: string;
  gap: number;
  newRank: number;
}

/**
 * Members someone passed between two standings snapshots. Only reported when
 * the member was in the top 5 or actually dropped a rank. The overtaker is
 * the closest passer above them.
 */
export function detectOvertakes<T extends Standing & { login: string }>(prev: T[], next: T[]): Overtake[] {
  const prevRank = new Map(prev.map((s) => [s.developer_id, s.rank]));
  const out: Overtake[] = [];
  for (const me of next) {
    const was = prevRank.get(me.developer_id);
    if (!was) continue;
    if (!(was <= 5 || me.rank > was)) continue;
    const passers = next.filter((o) => {
      const oWas = prevRank.get(o.developer_id);
      return o.rank < me.rank && oWas !== undefined && oWas > was && o.total > me.total;
    });
    const closest = passers[passers.length - 1];
    if (!closest) continue;
    out.push({ developerId: me.developer_id, overtakerLogin: closest.login, gap: closest.total - me.total, newRank: me.rank });
  }
  return out;
}
