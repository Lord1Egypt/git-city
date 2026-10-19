// ─── Brasil town: the cities ────────────────────────────────
// Brazil on its real outline (brasil-geo.ts), and in every state a city that
// grows around its capital with the devs who live there. A city is a street
// grid of small blocks (three lots a side, a street all round) laid out from
// its hub (the capital, moved inland). Its blocks are taken nearest first by
// a wobbly distance, so no two cities have the same outline. Its first block
// holds the square with the founder; in the others, two lots in three get a
// building and the rest are lawn and trees, so there's room to drive.
//
// A dev's lot is chosen once, when they arrive, and stored (BrasilPlacer):
// the next free lot of their state's city, in a block clear of every other
// city. Nothing already placed ever moves, so people find their building
// where they left it. The map isn't to scale (a drive across it is minutes),
// so a city may spill past its state's border, never onto another city.
// When a state's capital is boxed in (by the sea, by its neighbors), the
// state grows a second city where its biggest interior city is; if that
// fills too, the dev goes to the island, so nobody is ever left out.
// Highways are streets too: out along one capital's avenue, in along the
// other's. Devs who never said their state live on the island off the
// north-east coast (Fernando de Noronha), which grows out to sea.
//
// Pure: lots in, lots out (lib/league-city/grid).

import { LOT } from "../league-city/grid";
import { inDriftSite } from "./brasil-drift";
import { CAPITALS, ISLAND, SECOND_CITIES, coastDistance, inState, onLand, project, stateMiddle } from "./brasil-geo";

export type UF =
  | "AC"
  | "AL"
  | "AP"
  | "AM"
  | "BA"
  | "CE"
  | "DF"
  | "ES"
  | "GO"
  | "MA"
  | "MT"
  | "MS"
  | "MG"
  | "PA"
  | "PB"
  | "PR"
  | "PE"
  | "PI"
  | "RJ"
  | "RN"
  | "RS"
  | "RO"
  | "RR"
  | "SC"
  | "SP"
  | "SE"
  | "TO";

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
  /** The island's smallest radius (lots), for its shore. */
  islandMin: 5,
  /** Open sea (lots) between the island's hub and the coast; its blocks keep islandShore of it. */
  islandSea: 16,
  islandShore: 10,
} as const;

const P = CITY.block + 1;
/** Blocks considered round a hub, each way: far more than any city needs. */
const R = 40;

/** A dev living on the map. */
export interface MapDev {
  id: number;
  login: string;
  /** Null: never said their state (the island). */
  uf: UF | null;
}

/** Which of a state's cities a lot is in: its capital, its second city, or the island (a full state's overflow). */
export const HUB = { capital: 0, second: 1, island: 9 } as const;

/** A dev with their stored lot, in the order they arrived (`at`: ms, or any increasing number). */
export interface Resident {
  dev: MapDev;
  x: number;
  z: number;
  /** HUB: the city the lot belongs to. */
  hub: number;
  at: number;
}

export interface CityLayout {
  uf: UF | null;
  name: string;
  /** A state's second city (no tag of its own, no founder). */
  second: boolean;
  /** The city's square (lot): its tag stands here. */
  center: [number, number];
  /** In the order they arrived (`at`, as stored). */
  devs: { dev: MapDev; x: number; z: number; founder: boolean; at: number }[];
  roads: [number, number][];
  /** Lawn lots inside the city (trees go here). */
  lawns: [number, number][];
  /** How far the city reaches from its hub (lots), for the island's shore and the camera. */
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
const key = (x: number, z: number) => `${x},${z}`;
type Owner = UF | "island";

/** A city's lot near `at`, moved toward the state's middle until it stands clear of the coast. */
function cityHub(uf: UF, at: [number, number]): [number, number] {
  const [cx, cz] = project(at);
  const [mx, mz] = stateMiddle(uf);
  const need = CITY.inlandLots * LOT;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = cx + (mx - cx) * t;
    const z = cz + (mz - cz) * t;
    if (inState(uf, x, z) && onLand(x, z) && coastDistance(x, z) >= need) return toLot([x, z]);
  }
  return toLot([mx, mz]);
}

/** Fernando de Noronha, pushed out to sea until it's well clear of the coast. */
function islandHub(): [number, number] {
  const [x, z] = toLot(project(ISLAND.at));
  let dx = 0;
  while (onLand((x + dx) * LOT, z * LOT) || coastDistance((x + dx) * LOT, z * LOT) < CITY.islandSea * LOT) dx++;
  return [x + dx, z];
}

/** A city's fixed plan: where it starts, which land it may use, the order it takes its blocks in. */
interface Plan {
  id: string;
  owner: Owner;
  /** HUB: which of the owner's cities. */
  hub: number;
  name: string;
  seed: number;
  fits: (x: number, z: number) => boolean;
  /** Block indices (bx, bz) nearest first, by a wobbly distance. */
  order: [number, number][];
  /** The plan's hub lot. */
  at: [number, number];
}

const plans = new Map<string, Plan>();

/** The cities a dev may live in, in the order they fill. */
function hubsOf(owner: Owner): number[] {
  if (owner === "island") return [HUB.island];
  return SECOND_CITIES[owner] ? [HUB.capital, HUB.second, HUB.island] : [HUB.capital, HUB.island];
}

function planOf(owner: Owner, hubIndex: number = owner === "island" ? HUB.island : HUB.capital): Plan {
  // A full state's overflow lives on the island's grid, like the islanders.
  if (hubIndex === HUB.island) owner = "island";
  const id = `${owner}#${hubIndex}`;
  const cached = plans.get(id);
  if (cached) return cached;
  const base = owner === "island" ? 99 : STATES.findIndex((s) => s.uf === owner) + 1;
  const seed = base + hubIndex * 31;
  const second = owner !== "island" && hubIndex === HUB.second ? SECOND_CITIES[owner] : undefined;
  const hub = owner === "island" ? islandHub() : cityHub(owner, (second ?? CAPITALS[owner]).at);
  const coast = CITY.coastLots * LOT;
  const fits =
    owner === "island"
      ? (x: number, z: number) => !onLand(x * LOT, z * LOT) && coastDistance(x * LOT, z * LOT) >= CITY.islandShore * LOT
      : // The drift track's lots are nobody's: no block, no avenue grows into them.
        (x: number, z: number) => onLand(x * LOT, z * LOT) && coastDistance(x * LOT, z * LOT) >= coast && !inDriftSite(x, z);
  const phase = hash(seed, 7, 3) * Math.PI * 2;
  const wob = (a: number) => 1 + CITY.wobble * (0.6 * Math.sin(2 * a + phase) + 0.4 * Math.sin(3 * a + phase * 1.7));
  const order: { b: [number, number]; d: number }[] = [];
  for (let bx = -R; bx <= R; bx++) {
    for (let bz = -R; bz <= R; bz++) order.push({ b: [bx, bz], d: Math.hypot(bx + 0.5, bz + 0.5) / wob(Math.atan2(bz + 0.5, bx + 0.5)) });
  }
  order.sort((a, b) => a.d - b.d || a.b[0] - b.b[0] || a.b[1] - b.b[1]);
  const name = owner === "island" ? ISLAND.name : (second ?? CAPITALS[owner]).city;
  const plan: Plan = { id, owner, hub: hubIndex, name, seed, fits, order: order.map((o) => o.b), at: hub };
  plans.set(id, plan);
  return plan;
}

/** A block's lots (inside its streets), and its middle lot. */
function blockLots(plan: Plan, [bx, bz]: [number, number]): { lots: [number, number][]; mid: [number, number] } {
  const [hx, hz] = plan.at;
  const lots: [number, number][] = [];
  for (let u = 1; u <= CITY.block; u++) for (let v = 1; v <= CITY.block; v++) lots.push([hx + bx * P + u, hz + bz * P + v]);
  return { lots, mid: lots[Math.floor(lots.length / 2)] };
}

/** The block (bx, bz) of a city's grid a lot falls in, or null on a street. */
function blockAt(plan: Plan, x: number, z: number): [number, number] | null {
  const u = x - plan.at[0];
  const v = z - plan.at[1];
  const mu = ((u % P) + P) % P;
  const mv = ((v % P) + P) % P;
  if (mu === 0 || mv === 0) return null;
  return [Math.floor(u / P), Math.floor(v / P)];
}

/** The lots a block may hold buildings on, in the order they fill. The first block keeps its middle as the square. */
function buildLots(plan: Plan, block: [number, number], first: boolean): [number, number][] {
  const { lots, mid } = blockLots(plan, block);
  return lots.filter(([x, z]) => !(x === mid[0] && z === mid[1]) && (first || hash(x, z, plan.seed) >= CITY.lawn));
}

const ownerOf = (dev: MapDev): Owner => (dev.uf && BY_UF.has(dev.uf) ? dev.uf : "island");
const planOfResident = (r: Resident) => planOf(ownerOf(r.dev), r.hub);

/**
 * Chooses lots for arriving devs, given everyone already placed. Keeps, per
 * city, the blocks it uses (its first block is the founder's), and every lot
 * claimed by a city's blocks plus the gap round them.
 */
export class BrasilPlacer {
  private taken = new Set<string>();
  private claims = new Map<string, string>();
  private used = new Map<string, { blocks: string[]; set: Set<string> }>();
  /**
   * Per city, how far down its block order every block is settled for good:
   * full, or closed to it (another city's ground, or not land). Neither ever
   * changes back, so the next search starts there.
   */
  private cursor = new Map<string, number>();

  constructor(residents: readonly Resident[] = []) {
    for (const r of [...residents].sort((a, b) => a.at - b.at)) this.record(planOfResident(r), r.x, r.z);
  }

  private usedOf(plan: Plan) {
    let u = this.used.get(plan.id);
    if (!u) this.used.set(plan.id, (u = { blocks: [], set: new Set() }));
    return u;
  }

  private record(plan: Plan, x: number, z: number) {
    this.taken.add(key(x, z));
    const b = blockAt(plan, x, z);
    if (!b) return;
    const u = this.usedOf(plan);
    const bk = key(b[0], b[1]);
    if (u.set.has(bk)) return;
    u.set.add(bk);
    u.blocks.push(bk);
    // The block, its streets and the gap round them belong to this city now.
    const [hx, hz] = plan.at;
    const g = CITY.gapLots;
    for (let lx = hx + b[0] * P - g; lx <= hx + b[0] * P + P + g; lx++) {
      for (let lz = hz + b[1] * P - g; lz <= hz + b[1] * P + P + g; lz++) if (!this.claims.has(key(lx, lz))) this.claims.set(key(lx, lz), plan.id);
    }
  }

  /** Whether a city may start using a block: on its land, nobody else's ground, its streets off the drift track. */
  private free(plan: Plan, block: [number, number]): boolean {
    const [hx, hz] = plan.at;
    for (let lx = hx + block[0] * P; lx <= hx + block[0] * P + P; lx++) {
      for (let lz = hz + block[1] * P; lz <= hz + block[1] * P + P; lz++) {
        // Its streets too stay off the drift track.
        if (inDriftSite(lx, lz)) return false;
        const c = this.claims.get(key(lx, lz));
        if (c && c !== plan.id) return false;
      }
    }
    return blockLots(plan, block).lots.every(([x, z]) => plan.fits(x, z));
  }

  /** A city's first block (the founder's), or where it would start if it had nobody yet. */
  firstBlock(plan: Plan): [number, number] | null {
    const u = this.used.get(plan.id);
    if (u?.blocks.length) return u.blocks[0].split(",").map(Number) as [number, number];
    return plan.order.find((b) => this.free(plan, b)) ?? null;
  }

  /** The next free lot in one city, or null when it can't grow any more. */
  private placeIn(plan: Plan): [number, number] | null {
    const u = this.usedOf(plan);
    // The city's first block is the first one it ever used (the founder's); with nobody yet, the one about to be.
    const first = u.blocks[0]?.split(",").map(Number) as [number, number] | undefined;
    for (let i = this.cursor.get(plan.id) ?? 0; i < plan.order.length; i++) {
      const b = plan.order[i];
      if (!u.set.has(key(b[0], b[1])) && !this.free(plan, b)) {
        this.cursor.set(plan.id, i + 1);
        continue;
      }
      const isFirst = first ? b[0] === first[0] && b[1] === first[1] : u.blocks.length === 0;
      const lots = buildLots(plan, b, isFirst);
      const lot = lots.find(([x, z]) => !this.taken.has(key(x, z)));
      if (!lot) {
        this.cursor.set(plan.id, i + 1);
        continue;
      }
      this.record(plan, lot[0], lot[1]);
      // This block just filled up: nothing more to look for in it.
      if (lots.every(([x, z]) => this.taken.has(key(x, z)))) this.cursor.set(plan.id, i + 1);
      return lot;
    }
    return null;
  }

  /** The next lot for a dev: their capital's, else their second city's, else the island's. */
  place(dev: MapDev): { x: number; z: number; hub: number } | null {
    const owner = ownerOf(dev);
    for (const hub of hubsOf(owner)) {
      const lot = this.placeIn(planOf(owner, hub));
      if (lot) return { x: lot[0], z: lot[1], hub };
    }
    return null;
  }

  /** The blocks a city uses, in the order it took them. */
  blocksOf(plan: Plan): [number, number][] {
    return (this.used.get(plan.id)?.blocks ?? []).map((k) => k.split(",").map(Number) as [number, number]);
  }
}

/** One city from its stored residents (and the placer, for an empty city's square). */
function cityLayout(plan: Plan, residents: Resident[], placer: BrasilPlacer, foundedHere: boolean): CityLayout {
  const [hx, hz] = plan.at;
  const sorted = [...residents].sort((a, b) => a.at - b.at);
  const first = placer.firstBlock(plan);
  const blocks = placer.blocksOf(plan);
  const square = first ? blockLots(plan, first).mid : plan.at;
  const taken = new Set(sorted.map((r) => key(r.x, r.z)));
  taken.add(key(square[0], square[1]));

  // A street round every block in use (the square's block even when nobody lives there yet).
  const streetBlocks = blocks.length ? blocks : first ? [first] : [];
  const roads = new Set<string>();
  let radius = 2;
  for (const [bx, bz] of streetBlocks) {
    const x0 = hx + bx * P;
    const z0 = hz + bz * P;
    for (let k = 0; k <= P; k++) {
      roads.add(key(x0 + k, z0));
      roads.add(key(x0 + k, z0 + P));
      roads.add(key(x0, z0 + k));
      roads.add(key(x0 + P, z0 + k));
    }
    radius = Math.max(radius, Math.hypot(bx + 0.5, bz + 0.5) * P + P);
  }
  // The mainland's two avenues run on a block past the city, to meet the highways.
  if (plan.owner !== "island") {
    const reach = Math.ceil(radius) + P;
    for (let k = -reach; k <= reach; k++) {
      if (plan.fits(hx + k, hz)) roads.add(key(hx + k, hz));
      if (plan.fits(hx, hz + k)) roads.add(key(hx, hz + k));
    }
  }
  const lawns: [number, number][] = [];
  for (const b of streetBlocks) for (const [x, z] of blockLots(plan, b).lots) if (!taken.has(key(x, z)) && !roads.has(key(x, z))) lawns.push([x, z]);

  return {
    uf: plan.owner === "island" ? null : plan.owner,
    name: plan.name,
    second: plan.hub === HUB.second,
    center: square,
    devs: sorted.map((r, i) => ({ dev: r.dev, x: r.x, z: r.z, founder: foundedHere && i === 0, at: r.at })),
    roads: [...roads].filter((k) => !taken.has(k)).map((k) => k.split(",").map(Number) as [number, number]),
    lawns,
    radius,
    blocks: streetBlocks.map(([bx, bz]) => [hx + bx * P + 1, hz + bz * P + 1] as [number, number]),
    hub: plan.at,
  };
}

/**
 * The whole map from stored residents: every state's capital (and its second
 * city once it has anyone), the island, the highways.
 */
export function layoutFromResidents(residents: readonly Resident[]): BrasilLayout {
  const placer = new BrasilPlacer(residents);
  const byPlan = new Map<string, Resident[]>();
  for (const r of residents) {
    const id = planOfResident(r).id;
    byPlan.set(id, [...(byPlan.get(id) ?? []), r]);
  }
  const cities: CityLayout[] = [];
  for (const s of STATES) {
    const capital = planOf(s.uf, HUB.capital);
    cities.push(cityLayout(capital, byPlan.get(capital.id) ?? [], placer, true));
  }
  for (const s of STATES) {
    if (!SECOND_CITIES[s.uf]) continue;
    const second = planOf(s.uf, HUB.second);
    const here = byPlan.get(second.id);
    if (here?.length) cities.push(cityLayout(second, here, placer, false));
  }
  const islandPlan = planOf("island");
  const island = cityLayout(islandPlan, byPlan.get(islandPlan.id) ?? [], placer, false);
  // The island's first arrival who never said a state is its founder (overflow from full states isn't).
  const firstIslander = island.devs.find((d) => d.dev.uf === null);
  if (firstIslander) firstIslander.founder = true;
  island.radius = Math.max(CITY.islandMin, island.radius);
  // A street never runs over anyone's building, lawn or square (an avenue reaching into a neighbor stops there).
  const solid = new Set([...cities, island].flatMap((c) => [...c.devs.map((d) => key(d.x, d.z)), ...c.lawns.map((l) => l.join()), c.center.join()]));
  for (const c of [...cities, island]) c.roads = c.roads.filter(([x, z]) => !solid.has(key(x, z)));
  return { cities, island, highways: highways(cities) };
}

/** Devs arriving one by one in this order (the preview, the tests): each placed as the site would. */
export function layoutBrasil(devs: readonly MapDev[]): BrasilLayout {
  const placer = new BrasilPlacer();
  const residents: Resident[] = [];
  devs.forEach((dev, i) => {
    const lot = placer.place(dev);
    if (lot) residents.push({ dev, x: lot.x, z: lot.z, hub: lot.hub, at: i });
  });
  return layoutFromResidents(residents);
}

/**
 * Each capital to its two nearest, once per pair: out along one's east-west
 * avenue, in along the other's north-south one. Never over a building, a lawn,
 * the sea or the drift track (a highway through a city runs on its streets).
 */
function highways(cities: CityLayout[]): [number, number][] {
  const blocked = new Set(cities.flatMap((c) => [...c.devs.map((d) => key(d.x, d.z)), ...c.lawns.map((l) => l.join()), c.center.join()]));
  const streets = new Set(cities.flatMap((c) => c.roads.map((r) => r.join())));
  const out = new Set<string>();
  const link = (a: CityLayout, b: CityLayout) => {
    const [ax, az] = a.hub;
    const [bx, bz] = b.hub;
    const lots: [number, number][] = [];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) lots.push([x, az]);
    for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) lots.push([bx, z]);
    for (const [x, z] of lots) {
      const k = key(x, z);
      if (!blocked.has(k) && !streets.has(k) && onLand(x * LOT, z * LOT) && !inDriftSite(x, z)) out.add(k);
    }
  };
  const capitals = cities.filter((c) => !c.second);
  const seen = new Set<string>();
  capitals.forEach((a, i) => {
    capitals
      .map((b, j) => ({ j, d: Math.hypot(b.hub[0] - a.hub[0], b.hub[1] - a.hub[1]) }))
      .filter((e) => e.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => {
        const pair = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(pair)) return;
        seen.add(pair);
        link(a, capitals[j]);
      });
  });
  // A second city hangs off its capital.
  for (const c of cities) if (c.second) link(c, capitals.find((k) => k.uf === c.uf)!);
  return [...out].map((k) => k.split(",").map(Number) as [number, number]);
}

/** States by devs (all their cities, and their overflow on the island), most first; ties by name order. */
export function ranking(layout: BrasilLayout): { uf: UF; devs: number }[] {
  const n = new Map<UF, number>();
  for (const c of [...layout.cities, layout.island]) for (const d of c.devs) if (d.dev.uf) n.set(d.dev.uf, (n.get(d.dev.uf) ?? 0) + 1);
  return STATES.filter((s) => n.has(s.uf))
    .map((s) => ({ uf: s.uf, devs: n.get(s.uf)! }))
    .sort((a, b) => b.devs - a.devs);
}

/** Portuguese takes an article with most states: "o Acre", "a Bahia", plain "São Paulo". */
const ARTICLE: Record<UF, "o" | "a" | ""> = {
  AC: "o",
  AL: "",
  AP: "o",
  AM: "o",
  BA: "a",
  CE: "o",
  DF: "o",
  ES: "o",
  GO: "",
  MA: "o",
  MT: "o",
  MS: "o",
  MG: "",
  PA: "o",
  PB: "a",
  PR: "o",
  PE: "",
  PI: "o",
  RJ: "o",
  RN: "o",
  RS: "o",
  RO: "",
  RR: "",
  SC: "",
  SP: "",
  SE: "",
  TO: "o",
};

/** The state in a Portuguese sentence: "o Acre" / "São Paulo" ("the"), "no Acre" / "em São Paulo" ("in"), "do Acre" / "de São Paulo" ("of"). */
export function ptState(uf: UF, form: "the" | "in" | "of"): string {
  const name = stateOf(uf).name;
  const a = ARTICLE[uf];
  if (form === "the") return a ? `${a} ${name}` : name;
  const [masc, fem, none] = form === "in" ? ["no", "na", "em"] : ["do", "da", "de"];
  return `${a === "o" ? masc : a === "a" ? fem : none} ${name}`;
}
