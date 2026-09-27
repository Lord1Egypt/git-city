// ─── Hall of fame (pure) ────────────────────────────────────
// The Season grid: the weeks shown, each crowned member's weeks, the town's
// monument weeks.

export interface HallWeek {
  week_start: string;
  winner: { login: string; avatar_url: string | null } | null;
  monument: boolean;
}

export interface Champion {
  login: string;
  avatar_url: string | null;
  crowns: number;
  weeks: Set<string>;
}

/** Crowned members, most crowns first, then the most recent win. */
export function champions(weeks: HallWeek[]): Champion[] {
  const byLogin = new Map<string, Champion & { last: string }>();
  for (const w of weeks) {
    if (!w.winner) continue;
    const c = byLogin.get(w.winner.login) ?? { login: w.winner.login, avatar_url: w.winner.avatar_url, crowns: 0, weeks: new Set<string>(), last: "" };
    c.crowns++;
    c.weeks.add(w.week_start);
    if (w.week_start > c.last) c.last = w.week_start;
    byLogin.set(w.winner.login, c);
  }
  return [...byLogin.values()]
    .sort((a, b) => b.crowns - a.crowns || b.last.localeCompare(a.last) || a.login.localeCompare(b.login))
    .map((c) => ({ login: c.login, avatar_url: c.avatar_url, crowns: c.crowns, weeks: c.weeks }));
}

/** The last `n` weeks, oldest first (the grid reads left to right, now on the right). */
export function gridWeeks(weeks: HallWeek[], n: number): string[] {
  return [...weeks]
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, n)
    .map((w) => w.week_start)
    .reverse();
}

export function monumentWeeks(weeks: HallWeek[]): Set<string> {
  return new Set(weeks.filter((w) => w.monument).map((w) => w.week_start));
}
