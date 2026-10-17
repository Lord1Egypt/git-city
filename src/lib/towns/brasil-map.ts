// ─── Brasil town: the cities ────────────────────────────────
// Brazil on its real outline (brasil-geo.ts), and in every state a city that
// grows around its capital with the devs who live there. A city is a street
// grid of small blocks (three lots a side, a street all round); its first
// block is the square with the founder, then blocks fill outward, the order
// bent by a little noise per state so no two cities have the same outline.
// In a block, two lots in three get a building: the rest, and the middle lot,
// are lawn and trees, so there's always room to drive. The map isn't to
// scale (a drive across it is minutes, not hours), so cities don't fit in
// their states: the biggest grows first and the others grow round it, a
// block apart, always on land. A capital on the coast moves inland.
// Highways are streets too: out along one capital's avenue, in along the
// other's.
//
// Devs who never said their state live on the island (Fernando de Noronha),
// which grows the same way. Pure: lots in, lots out (lib/league-city/grid).

import { LOT } from "../league-city/grid";
import { CAPITALS, ISLAND, coastDistance, inState, onLand, project, stateMiddle } from "./brasil-geo";

export type UF =
  | "AC" | "AL" | "AP" | "AM" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MT" | "MS" | "MG" | "PA"
  | "PB" | "PR" | "PE" | "PI" | "RJ" | "RN" | "RS" | "RO" | "RR" | "SC" | "SP" | "SE" | "TO";

export interface BrState {
  uf: UF;
  name: string;
  /** The state flag's main colors, for its tag. */
  colors: string[];
  /** People, millions (2022 census): the preview's fake devs follow it. */
  pop: number;
}

export const STATES: BrState[] = [
  { uf: "AC", name: "Acre", colors: ["#f2c300", "#1d8a3c", "#d62828"], pop: 0.83 },
  { uf: "AL", name: "Alagoas", colors: ["#d62828", "#ffffff", "#1f4fa8"], pop: 3.1 },
  { uf: "AP", name: "Amapá", colors: ["#1f4fa8", "#f2c300", "#1d8a3c"], pop: 0.73 },
  { uf: "AM", name: "Amazonas", colors: ["#ffffff", "#1f4fa8", "#d62828"], pop: 3.9 },
  { uf: "BA", name: "Bahia", colors: ["#1f4fa8", "#ffffff", "#d62828"], pop: 14.1 },
  { uf: "CE", name: "Ceará", colors: ["#1d8a3c", "#f2c300", "#ffffff"], pop: 8.8 },
  { uf: "DF", name: "Distrito Federal", colors: ["#ffffff", "#1d8a3c", "#f2c300"], pop: 2.8 },
  { uf: "ES", name: "Espírito Santo", colors: ["#1f4fa8", "#ffffff", "#f4a6c8"], pop: 3.8 },
  { uf: "GO", name: "Goiás", colors: ["#1d8a3c", "#f2c300", "#1f4fa8"], pop: 7.1 },
  { uf: "MA", name: "Maranhão", colors: ["#d62828", "#ffffff", "#111111"], pop: 6.8 },
  { uf: "MT", name: "Mato Grosso", colors: ["#1f4fa8", "#ffffff", "#1d8a3c"], pop: 3.7 },
  { uf: "MS", name: "Mato Grosso do Sul", colors: ["#ffffff", "#1d8a3c", "#1f4fa8"], pop: 2.8 },
  { uf: "MG", name: "Minas Gerais", colors: ["#ffffff", "#d62828", "#ffffff"], pop: 20.5 },
  { uf: "PA", name: "Pará", colors: ["#d62828", "#ffffff", "#1f4fa8"], pop: 8.1 },
  { uf: "PB", name: "Paraíba", colors: ["#111111", "#d62828", "#ffffff"], pop: 4.0 },
  { uf: "PR", name: "Paraná", colors: ["#1d8a3c", "#ffffff", "#1f4fa8"], pop: 11.4 },
  { uf: "PE", name: "Pernambuco", colors: ["#1f4fa8", "#ffffff", "#d62828"], pop: 9.1 },
  { uf: "PI", name: "Piauí", colors: ["#1d8a3c", "#f2c300", "#1f4fa8"], pop: 3.3 },
  { uf: "RJ", name: "Rio de Janeiro", colors: ["#1f4fa8", "#ffffff", "#1f4fa8"], pop: 16.1 },
  { uf: "RN", name: "Rio Grande do Norte", colors: ["#1d8a3c", "#ffffff", "#f2c300"], pop: 3.3 },
  { uf: "RS", name: "Rio Grande do Sul", colors: ["#1d8a3c", "#d62828", "#f2c300"], pop: 10.9 },
  { uf: "RO", name: "Rondônia", colors: ["#1f4fa8", "#f2c300", "#1d8a3c"], pop: 1.6 },
  { uf: "RR", name: "Roraima", colors: ["#1f4fa8", "#ffffff", "#1d8a3c"], pop: 0.64 },
  { uf: "SC", name: "Santa Catarina", colors: ["#d62828", "#ffffff", "#1d8a3c"], pop: 7.6 },
  { uf: "SP", name: "São Paulo", colors: ["#111111", "#ffffff", "#d62828"], pop: 44.4 },
  { uf: "SE", name: "Sergipe", colors: ["#1d8a3c", "#f2c300", "#1f4fa8"], pop: 2.2 },
  { uf: "TO", name: "Tocantins", colors: ["#1f4fa8", "#f2c300", "#ffffff"], pop: 1.5 },
];

export const UFS = STATES.map((s) => s.uf);
const BY_UF = new Map(STATES.map((s) => [s.uf, s]));
export const stateOf = (uf: UF) => BY_UF.get(uf) as BrState;

/** A state's sigla in a comment ("SP", "sp"), or null. */
export function parseUF(word: string): UF | null {
  const u = word.trim().toUpperCase();
  return BY_UF.has(u as UF) ? (u as UF) : null;
}

export const CITY = {
  /** A block is this many lots a side, with a street all round (period = side + 1). */
  block: 3,
  /** Share of a block's edge lots left as lawn. */
  lawn: 0.34,
  /** How much the outline wobbles (0: round). */
  wobble: 0.35,
  /** Lots a city keeps from the coast. */
  coastLots: 1,
  /** Lots a capital moves inland so its first blocks are on land. */
  inlandLots: 4,
  /** Lots of open country kept between two cities. */
  gapLots: 3,
  /** The island's smallest radius (lots). */
  islandMin: 5,
  /** Open sea (lots) between the island's shore and the coast. */
  islandSea: 16,
} as const;

const P = CITY.block + 1;

/** A dev living on the map, in the order they came. */
export interface MapDev {
  id: number;
  login: string;
  /** Null: never said their state (the island). */
  uf: UF | null;
}

export interface CityLayout {
  uf: UF | null;
  name: string;
  /** The city's square (lot): its tag stands here. */
  center: [number, number];
  devs: { dev: MapDev; x: number; z: number; founder: boolean }[];
  roads: [number, number][];
  /** Lawn lots inside the city (trees go here). */
  lawns: [number, number][];
  /** How far the city reaches from its square (lots), for the island's land and the camera. */
  radius: number;
  /** The blocks in use: each one's north-west lot (inside its streets), for the paving. */
  blocks: [number, number][];
  /** Where the city's two avenues cross (a street lot): highways come in here. */
  hub: [number, number];
}

export interface BrasilLayout {
  cities: CityLayout[];
  island: CityLayout;
  /** Highway streets between neighboring capitals (lots). */
  highways: [number, number][];
}

function hash(x: number, z: number, s: number): number {
  let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const toLot = ([x, z]: [number, number]): [number, number] => [Math.round(x / LOT), Math.round(z / LOT)];

/** The capital's lot, moved toward the state's middle until it stands clear of the coast. */
function citySquare(uf: UF): [number, number] {
  const [cx, cz] = project(CAPITALS[uf].at);
  const [mx, mz] = stateMiddle(uf);
  const need = CITY.inlandLots * LOT;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = cx + (mx - cx) * t;
    const z = cz + (mz - cz) * t;
    if (inState(uf, x, z) && onLand(x, z) && coastDistance(x, z) >= need) return toLot([x, z]);
  }
  return toLot([mx, mz]);
}

/**
 * Grows one city: `fits` says whether a lot is land the city may use.
 * Blocks are taken nearest first (by a wobbly distance), whole, so the
 * neighborhood fills before the next one starts.
 */
function grow(
  uf: UF | null,
  name: string,
  center: [number, number],
  devs: MapDev[],
  seed: number,
  fits: (x: number, z: number) => boolean,
  /** The two avenues run on past the last block (to meet the highways); the island's don't. */
  avenues = true,
): CityLayout {
  const [cx, cz] = center;
  const blockOf = (bx: number, bz: number) => {
    const lots: [number, number][] = [];
    for (let u = 1; u <= CITY.block; u++) for (let v = 1; v <= CITY.block; v++) lots.push([cx + bx * P + u, cz + bz * P + v]);
    return lots;
  };
  const phase = hash(seed, 7, 3) * Math.PI * 2;
  const wob = (a: number) => 1 + CITY.wobble * (0.6 * Math.sin(2 * a + phase) + 0.4 * Math.sin(3 * a + phase * 1.7));
  const blocks: { bx: number; bz: number; d: number }[] = [];
  const R = 40;
  for (let bx = -R; bx <= R; bx++) {
    for (let bz = -R; bz <= R; bz++) {
      const a = Math.atan2(bz + 0.5, bx + 0.5);
      blocks.push({ bx, bz, d: Math.hypot(bx + 0.5, bz + 0.5) / wob(a) });
    }
  }
  blocks.sort((a, b) => a.d - b.d || a.bx - b.bx || a.bz - b.bz);

  const placed: CityLayout["devs"] = [];
  const lawns: [number, number][] = [];
  const used: { bx: number; bz: number }[] = [];
  let square: [number, number] | null = null;
  let i = 0;
  for (const b of blocks) {
    if (placed.length >= devs.length && square) break;
    const lots = blockOf(b.bx, b.bz);
    if (!lots.every(([x, z]) => fits(x, z))) continue;
    used.push(b);
    const mid = lots[Math.floor(lots.length / 2)];
    if (!square) {
      // The first block: the square in the middle, the founder beside it.
      square = mid;
      for (const [x, z] of lots) {
        if (x === mid[0] && z === mid[1]) continue;
        if (i < devs.length) placed.push({ dev: devs[i], x, z, founder: i++ === 0 });
        else lawns.push([x, z]);
      }
      continue;
    }
    for (const [x, z] of lots) {
      const lawn = (x === mid[0] && z === mid[1]) || hash(x, z, seed) < CITY.lawn;
      if (!lawn && i < devs.length) placed.push({ dev: devs[i], x, z, founder: i++ === 0 });
      else lawns.push([x, z]);
    }
  }

  // A street round every block in use, and the two avenues out of the square a block further.
  const roads = new Set<string>();
  let radius = 2;
  for (const b of used) {
    const x0 = cx + b.bx * P;
    const z0 = cz + b.bz * P;
    for (let k = 0; k <= P; k++) {
      roads.add(`${x0 + k},${z0}`);
      roads.add(`${x0 + k},${z0 + P}`);
      roads.add(`${x0},${z0 + k}`);
      roads.add(`${x0 + P},${z0 + k}`);
    }
    radius = Math.max(radius, Math.hypot(b.bx + 0.5, b.bz + 0.5) * P + P);
  }
  const reach = Math.ceil(radius) + P;
  for (let k = -reach; k <= reach && avenues; k++) {
    if (fits(cx + k, cz)) roads.add(`${cx + k},${cz}`);
    if (fits(cx, cz + k)) roads.add(`${cx},${cz + k}`);
  }
  const taken = new Set([...placed.map((p) => `${p.x},${p.z}`), ...(square ? [square.join()] : [])]);
  return {
    uf,
    name,
    center: square ?? center,
    devs: placed,
    roads: [...roads].filter((k) => !taken.has(k)).map((k) => k.split(",").map(Number) as [number, number]),
    lawns: lawns.filter(([x, z]) => !roads.has(`${x},${z}`)),
    radius,
    blocks: used.map((b) => [cx + b.bx * P + 1, cz + b.bz * P + 1] as [number, number]),
    hub: center,
  };
}

/** Every state's city around its capital, the island, and the highways between them. */
export function layoutBrasil(devs: readonly MapDev[]): BrasilLayout {
  const byUf = new Map<UF, MapDev[]>();
  const islanders: MapDev[] = [];
  for (const d of devs) {
    if (d.uf && BY_UF.has(d.uf)) byUf.set(d.uf, [...(byUf.get(d.uf) ?? []), d]);
    else islanders.push(d);
  }
  const coast = CITY.coastLots * LOT;
  // Lots a city has claimed (its blocks and streets, plus the gap round them): no one else builds there.
  const claimed = new Set<string>();
  const claim = (c: CityLayout) => {
    const g = CITY.gapLots;
    for (const [x0, z0] of c.blocks) {
      for (let x = x0 - 1 - g; x <= x0 + CITY.block + g; x++) for (let z = z0 - 1 - g; z <= z0 + CITY.block + g; z++) claimed.add(`${x},${z}`);
    }
  };
  // The biggest city first: it keeps its capital's ground.
  const order = STATES.map((s, k) => ({ s, k, n: byUf.get(s.uf)?.length ?? 0 })).sort((a, b) => b.n - a.n || a.k - b.k);
  const grown = new Map<UF, CityLayout>();
  for (const { s, k } of order) {
    const city = grow(s.uf, CAPITALS[s.uf].city, citySquare(s.uf), byUf.get(s.uf) ?? [], k + 1, (x, z) => {
      const wx = x * LOT;
      const wz = z * LOT;
      return !claimed.has(`${x},${z}`) && onLand(wx, wz) && coastDistance(wx, wz) >= coast;
    });
    claim(city);
    grown.set(s.uf, city);
  }
  const cities = STATES.map((s) => grown.get(s.uf) as CityLayout);
  // The island is as big as it needs to be: grown on open water, its shore drawn round it,
  // then pushed out to sea until that shore is well clear of the coast.
  const at = toLot(project(ISLAND.at));
  let island = grow(null, ISLAND.name, at, islanders, 99, () => true, false);
  const reachLots = Math.max(CITY.islandMin, island.radius) + CITY.islandSea;
  let dx = 0;
  while (coastDistance((at[0] + dx) * LOT, at[1] * LOT) < reachLots * LOT || onLand((at[0] + dx) * LOT, at[1] * LOT)) dx++;
  if (dx > 0) island = grow(null, ISLAND.name, [at[0] + dx, at[1]], islanders, 99, () => true, false);
  island.radius = Math.max(CITY.islandMin, island.radius);
  return { cities, island, highways: highways(cities) };
}

/**
 * Each capital to its two nearest, once per pair: out along one's east-west
 * avenue, in along the other's north-south one. Never over a building or a
 * lawn (a highway through a city runs on its streets, or around).
 */
function highways(cities: CityLayout[]): [number, number][] {
  const blocked = new Set(cities.flatMap((c) => [...c.devs.map((d) => `${d.x},${d.z}`), ...c.lawns.map((l) => l.join()), c.center.join()]));
  const streets = new Set(cities.flatMap((c) => c.roads.map((r) => r.join())));
  const out = new Set<string>();
  const seen = new Set<string>();
  cities.forEach((a, i) => {
    cities
      .map((b, j) => ({ j, d: Math.hypot(b.center[0] - a.center[0], b.center[1] - a.center[1]) }))
      .filter((e) => e.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        const b = cities[j];
        const [ax, az] = a.hub;
        const [bx, bz] = b.hub;
        const lots: [number, number][] = [];
        for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) lots.push([x, az]);
        for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) lots.push([bx, z]);
        for (const [x, z] of lots) {
          const k = `${x},${z}`;
          if (!blocked.has(k) && !streets.has(k) && onLand(x * LOT, z * LOT)) out.add(k);
        }
      });
  });
  return [...out].map((k) => k.split(",").map(Number) as [number, number]);
}

/** States by devs, most first; ties by name order. */
export function ranking(layout: BrasilLayout): { uf: UF; devs: number }[] {
  return layout.cities
    .filter((c): c is CityLayout & { uf: UF } => c.uf !== null && c.devs.length > 0)
    .map((c) => ({ uf: c.uf, devs: c.devs.length }))
    .sort((a, b) => b.devs - a.devs);
}
