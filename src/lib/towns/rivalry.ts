import { weekStart } from "@/lib/leagues/scoring";

// The launch rivalry: two towns, and a dev can only be on one side. The week
// counts every contribution for the side you're on, so a side holds for the
// whole week: switching happens on Mondays only (Splatfest locks a team for the
// whole fest; Destiny's pledge held until the next rally).
export const RIVALRY = [
  { slug: "claude-code-town", name: "Claude", color: "#e07a4f" },
  { slug: "codex-town", name: "Codex", color: "#5b8def" },
] as const;

export type RivalSlug = (typeof RIVALRY)[number]["slug"];

/** The first battle week opens the Monday after the Oct 8 launch. Until then, sides are picked. */
export const BATTLE_START = Date.UTC(2026, 9, 12);
export const BATTLE_START_LABEL = "Mon, Oct 12";

/** "7d 20h" until `target`, "3h 12m" under a day, "" once it passed. */
export function timeUntil(target: number, now: number): string {
  const ms = target - now;
  if (ms <= 0) return "";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

/** Rivalry towns grow past the usual city size (supabase 157 matches this). */
export const RIVALRY_MAX_H = 40;

export function isRivalry(slug: string): boolean {
  return RIVALRY.some((s) => s.slug === slug);
}

/** The other side's slug, or null when the town isn't in the rivalry. */
export function rivalOf(slug: string): RivalSlug | null {
  const i = RIVALRY.findIndex((s) => s.slug === slug);
  return i === -1 ? null : RIVALRY[1 - i].slug;
}

export function rivalName(slug: string): string | null {
  return RIVALRY.find((s) => s.slug === slug)?.name ?? null;
}

export interface RivalMembership {
  status: string;
  joined_at: string | null;
  left_at?: string | null;
  removed_by?: number | null;
}

/**
 * What picking one side does to the dev's place on the other:
 * - none: never on it this week (or the admin removed them), nothing to do;
 * - switch: on it before this week and today is Monday, leave it;
 * - locked: on it this week, or not Monday yet: refuse.
 */
export type SideSwitch = "none" | "switch" | "locked";

export function sideSwitch(rival: RivalMembership | null, now: Date): SideSwitch {
  if (!rival) return "none";
  const week = weekStart(now);
  const monday = now.getUTCDay() === 1;
  const thisWeek = (at: string | null | undefined) => !!at && new Date(at) >= week;

  if (rival.status === "active") return monday && !thisWeek(rival.joined_at) ? "switch" : "locked";
  // Left the other side this week on their own: that week still belongs to it.
  if (rival.status === "former" && rival.removed_by == null && thisWeek(rival.left_at) && !monday) return "locked";
  if (rival.status === "former" && rival.removed_by == null && thisWeek(rival.left_at) && thisWeek(rival.joined_at)) return "locked";
  return "none";
}
