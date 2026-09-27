/**
 * Town of the week: the town that coded the most last week (first of the
 * close's ranking). `overrideId` (a staff pick) always wins. Null when no
 * town was ranked.
 */
export function pickTownOfWeek(ranked: string[], overrideId: string | null = null): string | null {
  return overrideId ?? ranked[0] ?? null;
}
