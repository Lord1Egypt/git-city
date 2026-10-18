// ─── Brasil town: the week's offices ────────────────────────
// Elected every week by contributions, from the town's standings (the towns'
// weekly race: Monday 00:00 UTC, each day capped at 100): the president is the
// top dev in Brazil, each state's governor its top dev and its three senators
// its top three (three per state, as in the real Senate), each city's mayor its
// top dev (a state's second city has its own). Only devs who coded count. The
// founder (the first to arrive in a state) is not elected and never changes.
// Pure.

import { STATES, type BrasilLayout, type UF } from "./brasil-map";

export type Office = { kind: "president" } | { kind: "governor"; uf: UF } | { kind: "senator"; uf: UF } | { kind: "mayor"; city: string; uf: UF };

export interface BrasilOffices {
  president: string | null;
  governors: Map<UF, string>;
  senators: Map<UF, string[]>;
  /** By city name (a state's capital or its second city). */
  mayors: Map<string, { login: string; uf: UF }>;
  /** Everything each login holds, highest first. */
  byLogin: Map<string, Office[]>;
}

/** `totals`: each login's (lowercase) contributions for the week the offices come from. */
export function brasilOffices(layout: BrasilLayout, totals: ReadonlyMap<string, number>): BrasilOffices {
  const score = (login: string) => totals.get(login.toLowerCase()) ?? 0;
  const rank = (logins: string[]) =>
    logins
      .filter((l) => score(l) > 0)
      .sort((a, b) => score(b) - score(a) || a.localeCompare(b))
      .map((l) => l.toLowerCase());

  const all = [...layout.cities, layout.island];
  const everyone = rank(all.flatMap((c) => c.devs.map((d) => d.dev.login)));
  const governors = new Map<UF, string>();
  const senators = new Map<UF, string[]>();
  const mayors = new Map<string, { login: string; uf: UF }>();
  for (const s of STATES) {
    const top = rank(all.flatMap((c) => c.devs.filter((d) => d.dev.uf === s.uf).map((d) => d.dev.login)));
    if (top[0]) governors.set(s.uf, top[0]);
    if (top.length) senators.set(s.uf, top.slice(0, 3));
  }
  for (const c of layout.cities) {
    if (!c.uf) continue;
    const top = rank(c.devs.filter((d) => d.dev.uf === c.uf).map((d) => d.dev.login));
    if (top[0]) mayors.set(c.name, { login: top[0], uf: c.uf });
  }

  const byLogin = new Map<string, Office[]>();
  const add = (login: string, o: Office) => byLogin.set(login, [...(byLogin.get(login) ?? []), o]);
  const president = everyone[0] ?? null;
  if (president) add(president, { kind: "president" });
  for (const [uf, l] of governors) add(l, { kind: "governor", uf });
  for (const [uf, ls] of senators) for (const l of ls) add(l, { kind: "senator", uf });
  for (const [city, m] of mayors) add(m.login, { kind: "mayor", city, uf: m.uf });
  return { president, governors, senators, mayors, byLogin };
}

/** An office as its badge says it. */
export function officeLabel(o: Office): string {
  if (o.kind === "president") return "President";
  if (o.kind === "governor") return `Governor of ${o.uf}`;
  if (o.kind === "senator") return `Senator for ${o.uf}`;
  return `Mayor of ${o.city}`;
}
