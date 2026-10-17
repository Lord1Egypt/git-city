// What the Brasil town's panels show about a state, from the layout and the
// residents' buildings: every dev who said that state (its capital, its
// second city, its overflow on the island), its founder, its place, its
// contributions and who came this week.

import type { CityBuilding } from "@/lib/github";
import { STATES, stateOf, type BrasilLayout, type CityLayout, type UF } from "@/lib/towns/brasil-map";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface StateStats {
  uf: UF;
  name: string;
  capital: CityLayout;
  second: CityLayout | null;
  devs: number;
  founder: string | null;
  contributions: number;
  newThisWeek: number;
  /** 1-based among states with anyone (states with nobody share the last place). */
  place: number;
  /** Logins, most contributions first. */
  top: string[];
}

export function stateStats(layout: BrasilLayout, byLogin: ReadonlyMap<string, CityBuilding>, now: number): StateStats[] {
  const all = [...layout.cities, layout.island];
  const rows = STATES.map((s) => {
    const devs = all.flatMap((c) => c.devs.filter((d) => d.dev.uf === s.uf));
    const capital = layout.cities.find((c) => c.uf === s.uf && !c.second) as CityLayout;
    const contrib = (login: string) => byLogin.get(login.toLowerCase())?.contributions ?? 0;
    return {
      uf: s.uf,
      name: stateOf(s.uf).name,
      capital,
      second: layout.cities.find((c) => c.uf === s.uf && c.second) ?? null,
      devs: devs.length,
      founder: capital.devs.find((d) => d.founder)?.dev.login ?? null,
      contributions: devs.reduce((n, d) => n + contrib(d.dev.login), 0),
      newThisWeek: devs.filter((d) => now - d.at < WEEK_MS).length,
      place: 0,
      top: [...devs].sort((a, b) => contrib(b.dev.login) - contrib(a.dev.login)).slice(0, 5).map((d) => d.dev.login),
    };
  });
  const ranked = [...rows].sort((a, b) => b.devs - a.devs || a.name.localeCompare(b.name));
  const last = ranked.filter((r) => r.devs > 0).length + 1;
  ranked.forEach((r, i) => (r.place = r.devs > 0 ? i + 1 : last));
  return ranked;
}

/** The state's swatch: its flag's first color that isn't white. */
export function swatchOf(uf: UF): string {
  const c = stateOf(uf).colors;
  return c[0] === "#ffffff" ? c[1] : c[0];
}
