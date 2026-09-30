import { BATTLE_START } from "./rivalry";
import type { TownScore } from "@/lib/leagues/scoring";

// ─── Claude vs Codex battle rules (pure) ────────────────────
// The week is won on per dev (competition spec): the side whose members who
// coded average more contributions. A side under 3 coders has no score and
// can't win. Days are the week's running story: each finished day goes to the
// side with the higher per-day average. Ties go to nobody.

export type Side = "claude" | "codex";

/** Side keys in RIVALRY order: index 0 is Claude, 1 is Codex. */
export const SIDES: readonly [Side, Side] = ["claude", "codex"];

/** Before BATTLE_START sides are picked; from it on, weeks count. */
export function battlePhase(now: number): "pick" | "live" {
  return now < BATTLE_START ? "pick" : "live";
}

/** The week's winner on per dev, or null (tie, or neither side has 3 coders). */
export function weekWinner(claude: TownScore | null, codex: TownScore | null): Side | null {
  if (!claude && !codex) return null;
  if (!codex) return "claude";
  if (!claude) return "codex";
  if (claude.perDev === codex.perDev) return null;
  return claude.perDev > codex.perDev ? "claude" : "codex";
}

/**
 * Who won each day, Mon..Sun, from the per-day averages. Only the first
 * `finished` days count (today is still being played): later ones are
 * "open". A tie, or a day nobody coded, is null.
 */
export function dayWinners(claude: number[], codex: number[], finished: number): (Side | null | "open")[] {
  return Array.from({ length: 7 }, (_, i) => {
    if (i >= finished) return "open";
    const a = claude[i] ?? 0;
    const b = codex[i] ?? 0;
    if (a === b) return null;
    return a > b ? "claude" : "codex";
  });
}

/** Days of the week (starting Monday `start`) already over at `now`: 0..7. */
export function finishedDays(start: Date, now: number): number {
  return Math.max(0, Math.min(7, Math.floor((now - start.getTime()) / 86_400_000)));
}

/** Week wins per side over the closed battle weeks. */
export function seriesRecord(winners: (Side | null)[]): Record<Side, number> {
  const out: Record<Side, number> = { claude: 0, codex: 0 };
  for (const w of winners) if (w) out[w]++;
  return out;
}

/** "Week 1" is the week starting BATTLE_START. */
export function battleWeekNumber(startDay: string): number {
  return Math.floor((Date.parse(`${startDay}T00:00:00Z`) - BATTLE_START) / (7 * 86_400_000)) + 1;
}
