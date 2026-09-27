// ─── Town race view (pure) ──────────────────────────────────
// What the town page's widget and panel pick out of the week: the towns
// around yours, the crew rows before "See all", and the day squares.

/** Towns shown around yours: the leader, the one above, yours, the one below. */
export function townsAround<T extends { league_id: string }>(
  ranking: T[],
  mineId: string,
): { rows: T[]; gapBefore: Set<string> } {
  const i = ranking.findIndex((t) => t.league_id === mineId);
  if (i < 0) return { rows: ranking.slice(0, 3), gapBefore: new Set() };
  const idx = [...new Set([0, i - 1, i, i + 1])].filter((k) => k >= 0 && k < ranking.length).sort((a, b) => a - b);
  const gapBefore = new Set<string>();
  idx.forEach((k, j) => {
    if (j > 0 && k - idx[j - 1] > 1) gapBefore.add(ranking[k].league_id);
  });
  return { rows: idx.map((k) => ranking[k]), gapBefore };
}

/** Crew rows in the panel before "See all". */
export const CREW_TOP = 3;

/**
 * The panel's crew: the top members who coded, plus you when you coded but
 * sit outside the top. `rest` counts everyone "See all" adds.
 */
export function crewSummary<T extends { login: string; total: number }>(
  standings: T[],
  viewerLogin: string | null,
): { top: T[]; you: { row: T; rank: number } | null; rest: number; idle: number } {
  const coding = standings.filter((s) => s.total > 0);
  const top = coding.slice(0, CREW_TOP);
  const i = viewerLogin ? standings.findIndex((s) => s.login.toLowerCase() === viewerLogin.toLowerCase()) : -1;
  const you = i >= CREW_TOP && standings[i].total > 0 ? { row: standings[i], rank: i + 1 } : null;
  return { top, you, rest: standings.length - top.length - (you ? 1 : 0), idle: standings.length - coding.length };
}

/** Day of the week in UTC, 0 = Monday … 6 = Sunday (the race's week). */
export function dayIndex(now: Date): number {
  return (now.getUTCDay() + 6) % 7;
}

/** GitHub-style square shade for a day's contributions (0 = none). */
export function dayLevel(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n < 5) return 1;
  if (n < 15) return 2;
  if (n < 40) return 3;
  return 4;
}

/** Square colors by level, from empty to the lime accent. */
export const DAY_COLORS = ["#26262c", "#3b4719", "#5a7320", "#8aaa1a", "#c8e64a"] as const;

export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
