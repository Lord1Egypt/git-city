import { TOWN_MIN_CODERS } from "@/lib/leagues/scoring";
import { townDisplayName } from "./names";

/** Where a town stands this week against the other towns. */
export interface TownPlace {
  rank: number | null;
  total: number;
  /** Members coding this week (shown while unranked). */
  coding: number;
  /** Rank 1: lead over 2nd. Otherwise: gap to the town just above. */
  gap: number | null;
  /** The town just above (null at rank 1 or unranked). */
  above: string | null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * The town's line on its page: "3rd of 12 towns · 40 behind Acme Town",
 * "1st of 12 towns · 12 ahead", or, unranked, "2 of 3 coding to rank".
 */
export function placeLine(p: TownPlace): string {
  if (p.rank === null) return `${Math.min(p.coding, TOWN_MIN_CODERS)} of ${TOWN_MIN_CODERS} coding to rank`;
  const where = `${ordinal(p.rank)} of ${p.total} town${p.total === 1 ? "" : "s"}`;
  if (p.rank === 1) return p.gap !== null && p.gap > 0 ? `${where} · ${p.gap} ahead` : where;
  if (p.above === null || p.gap === null) return where;
  return p.gap > 0 ? `${where} · ${p.gap} behind ${townDisplayName(p.above)}` : `${where} · tied with ${townDisplayName(p.above)}`;
}
