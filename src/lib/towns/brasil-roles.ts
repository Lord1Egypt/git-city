// ─── Brasil town: the week's offices ────────────────────────
// Elected every week by contributions, from the town's standings (the towns'
// weekly race: Monday 00:00 UTC, each day capped at 100). One office per
// person, filled from the top down: the president is the top dev in Brazil;
// each state's governor is its top dev left, its senator the next one; each
// city's mayor is its
// top dev left (a state's second city has its own). An office nobody is left
// for stays empty. Only devs who coded count. The founder (the first to
// arrive in a state) is not elected and never changes. Pure.

import { STATES, type BrasilLayout, type UF } from "./brasil-map";

export type Office = { kind: "president" } | { kind: "governor"; uf: UF } | { kind: "senator"; uf: UF } | { kind: "mayor"; city: string; uf: UF };

export interface BrasilOffices {
  president: string | null;
  governors: Map<UF, string>;
  senators: Map<UF, string[]>;
  /** By city name (a state's capital or its second city). */
  mayors: Map<string, { login: string; uf: UF }>;
  /** The office each login holds (one each). */
  byLogin: Map<string, Office[]>;
}

/** `totals`: each login's (lowercase) contributions for the week the offices come from. */
export function brasilOffices(layout: BrasilLayout, totals: ReadonlyMap<string, number>): BrasilOffices {
  const score = (login: string) => totals.get(login.toLowerCase()) ?? 0;
  const taken = new Set<string>();
  const rank = (logins: string[]) =>
    logins
      .map((l) => l.toLowerCase())
      .filter((l) => score(l) > 0 && !taken.has(l))
      .sort((a, b) => score(b) - score(a) || a.localeCompare(b));

  const all = [...layout.cities, layout.island];
  const byLogin = new Map<string, Office[]>();
  const give = (login: string, o: Office) => {
    taken.add(login);
    byLogin.set(login, [o]);
  };
  const president = rank(all.flatMap((c) => c.devs.map((d) => d.dev.login)))[0] ?? null;
  if (president) give(president, { kind: "president" });

  const governors = new Map<UF, string>();
  const senators = new Map<UF, string[]>();
  const inState = (uf: UF) => all.flatMap((c) => c.devs.filter((d) => d.dev.uf === uf).map((d) => d.dev.login));
  for (const s of STATES) {
    const gov = rank(inState(s.uf))[0];
    if (!gov) continue;
    governors.set(s.uf, gov);
    give(gov, { kind: "governor", uf: s.uf });
    const sen = rank(inState(s.uf)).slice(0, 1);
    if (sen.length) senators.set(s.uf, sen);
    for (const l of sen) give(l, { kind: "senator", uf: s.uf });
  }
  const mayors = new Map<string, { login: string; uf: UF }>();
  for (const c of layout.cities) {
    if (!c.uf) continue;
    const mayor = rank(c.devs.filter((d) => d.dev.uf === c.uf).map((d) => d.dev.login))[0];
    if (!mayor) continue;
    mayors.set(c.name, { login: mayor, uf: c.uf });
    give(mayor, { kind: "mayor", city: c.name, uf: c.uf });
  }
  return { president, governors, senators, mayors, byLogin };
}

/** An office as its badge says it. */
export function officeLabel(o: Office): string {
  if (o.kind === "president") return "President";
  if (o.kind === "governor") return `Governor of ${o.uf}`;
  if (o.kind === "senator") return `Senator for ${o.uf}`;
  return `Mayor of ${o.city}`;
}
