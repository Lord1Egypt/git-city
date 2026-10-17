// ─── Brasil town: a day's numbers ───────────────────────────
// What an episode says about a day, from the stored residents alone (each has
// the moment it took its lot): day N of the series, devs on the map and
// states with a founder at the end of that day, who arrived that day and
// which states got their founder. Days run on Brasília time (UTC-3, no
// daylight saving since 2019). A move takes a new lot, so it counts as
// arriving in the new state. Pure.

import { STATES, type Resident, type UF } from "./brasil-map";

/** Day 1 of the series. */
export const BRASIL_LAUNCH = "2026-10-19";
const BRT_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

export interface BrasilDay {
  /** 1 on launch day; 0 or less before it. */
  day: number;
  date: string;
  devs: number;
  founded: number;
  arrived: { login: string; uf: UF | null }[];
  newFounders: { login: string; uf: UF }[];
  /** Every state with devs at the end of the day, most first, with that day's arrivals. */
  states: { uf: UF; devs: number; today: number }[];
}

/** Start of a Brasília calendar day ("2026-10-19"), in ms. */
const startOf = (date: string) => Date.parse(`${date}T00:00:00Z`) + BRT_MS;

/** Today's date on Brasília time. */
export const brasiliaToday = (now = Date.now()) => new Date(now - BRT_MS).toISOString().slice(0, 10);

export function brasilDay(residents: Resident[], date: string, launch = BRASIL_LAUNCH): BrasilDay {
  const from = startOf(date);
  const to = from + DAY_MS;
  const upTo = residents.filter((r) => r.at < to).sort((a, b) => a.at - b.at);
  const firstOf = new Map<UF, Resident>();
  for (const r of upTo) if (r.dev.uf && !firstOf.has(r.dev.uf)) firstOf.set(r.dev.uf, r);
  const today = upTo.filter((r) => r.at >= from);
  const count = new Map<UF, { devs: number; today: number }>();
  for (const r of upTo) {
    if (!r.dev.uf) continue;
    const c = count.get(r.dev.uf) ?? { devs: 0, today: 0 };
    c.devs++;
    if (r.at >= from) c.today++;
    count.set(r.dev.uf, c);
  }
  return {
    day: Math.floor((from - startOf(launch)) / DAY_MS) + 1,
    date,
    devs: upTo.length,
    founded: firstOf.size,
    arrived: today.map((r) => ({ login: r.dev.login, uf: r.dev.uf })),
    newFounders: [...firstOf.values()].filter((r) => r.at >= from).map((r) => ({ login: r.dev.login, uf: r.dev.uf! })),
    states: STATES.map((s) => ({ uf: s.uf, ...(count.get(s.uf) ?? { devs: 0, today: 0 }) }))
      .filter((s) => s.devs > 0)
      .sort((a, b) => b.devs - a.devs || b.today - a.today),
  };
}

/** The day in one line, for the episode script. */
export function dayLine(d: BrasilDay): string {
  const founders = d.newFounders.length ? ` New founders: ${d.newFounders.map((f) => `@${f.login} (${f.uf})`).join(", ")}.` : "";
  return `${d.day > 0 ? `Day ${d.day}` : "Before launch"} · ${d.devs} devs · ${d.founded}/27 states founded · +${d.arrived.length} today.${founders}`;
}
