// ─── Brasil town: geography ─────────────────────────────────
// Brazil's real outline and states (IBGE meshes, simplified: brasil-geo.json)
// projected onto the town's world: north is -z, a degree is K world units,
// longitude shrunk by the cosine of the middle latitude so shapes keep their
// proportions. The whole country sits on the town grid like any town: its
// middle on x = 0, its southern tip just north of z = 0.
//
// Every state has its capital, where its city grows; Fernando de Noronha is
// the island for devs who never said their state.

import { LOT } from "../league-city/grid";
import RAW_GEO from "./brasil-geo.json";
import RIVERS_RAW from "./brasil-rivers.json";
import type { UF } from "./brasil-map";

/** World units per degree of latitude. */
export const K = 420;
const LAT0 = -14;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);

type LonLat = [number, number];

export const CAPITALS: Record<UF, { city: string; at: LonLat }> = {
  AC: { city: "Rio Branco", at: [-67.81, -9.97] },
  AL: { city: "Maceió", at: [-35.73, -9.67] },
  AP: { city: "Macapá", at: [-51.07, 0.03] },
  AM: { city: "Manaus", at: [-60.02, -3.12] },
  BA: { city: "Salvador", at: [-38.5, -12.97] },
  CE: { city: "Fortaleza", at: [-38.54, -3.73] },
  DF: { city: "Brasília", at: [-47.88, -15.79] },
  ES: { city: "Vitória", at: [-40.31, -20.32] },
  GO: { city: "Goiânia", at: [-49.25, -16.68] },
  MA: { city: "São Luís", at: [-44.3, -2.53] },
  MT: { city: "Cuiabá", at: [-56.1, -15.6] },
  MS: { city: "Campo Grande", at: [-54.62, -20.47] },
  MG: { city: "Belo Horizonte", at: [-43.94, -19.92] },
  PA: { city: "Belém", at: [-48.5, -1.46] },
  PB: { city: "João Pessoa", at: [-34.86, -7.12] },
  PR: { city: "Curitiba", at: [-49.27, -25.43] },
  PE: { city: "Recife", at: [-34.88, -8.05] },
  PI: { city: "Teresina", at: [-42.8, -5.09] },
  RJ: { city: "Rio de Janeiro", at: [-43.2, -22.91] },
  RN: { city: "Natal", at: [-35.21, -5.79] },
  RS: { city: "Porto Alegre", at: [-51.23, -30.03] },
  RO: { city: "Porto Velho", at: [-63.9, -8.76] },
  RR: { city: "Boa Vista", at: [-60.67, 2.82] },
  SC: { city: "Florianópolis", at: [-48.55, -27.6] },
  SP: { city: "São Paulo", at: [-46.63, -23.55] },
  SE: { city: "Aracaju", at: [-37.07, -10.91] },
  TO: { city: "Palmas", at: [-48.33, -10.18] },
};

export const ISLAND = { name: "Fernando de Noronha", at: [-32.42, -3.85] as LonLat };

/**
 * Each state's second city, where it grows once its capital is full: the
 * biggest city of the interior, far enough from the capital to have room
 * (so Ribeirão Preto, not Campinas). The Federal District has none.
 */
export const SECOND_CITIES: Partial<Record<UF, { city: string; at: LonLat }>> = {
  AC: { city: "Cruzeiro do Sul", at: [-72.67, -7.63] },
  AL: { city: "Arapiraca", at: [-36.66, -9.75] },
  AP: { city: "Oiapoque", at: [-51.83, 3.84] },
  AM: { city: "Parintins", at: [-56.74, -2.63] },
  BA: { city: "Feira de Santana", at: [-38.97, -12.27] },
  CE: { city: "Juazeiro do Norte", at: [-39.31, -7.21] },
  ES: { city: "Cachoeiro de Itapemirim", at: [-41.11, -20.85] },
  GO: { city: "Rio Verde", at: [-50.93, -17.79] },
  MA: { city: "Imperatriz", at: [-47.49, -5.53] },
  MT: { city: "Rondonópolis", at: [-54.64, -16.47] },
  MS: { city: "Dourados", at: [-54.81, -22.22] },
  MG: { city: "Uberlândia", at: [-48.28, -18.92] },
  PA: { city: "Santarém", at: [-54.71, -2.44] },
  PB: { city: "Campina Grande", at: [-35.88, -7.23] },
  PR: { city: "Londrina", at: [-51.16, -23.31] },
  PE: { city: "Caruaru", at: [-35.98, -8.28] },
  PI: { city: "Parnaíba", at: [-41.78, -2.9] },
  RJ: { city: "Campos dos Goytacazes", at: [-41.32, -21.75] },
  RN: { city: "Mossoró", at: [-37.34, -5.19] },
  RS: { city: "Caxias do Sul", at: [-51.18, -29.17] },
  RO: { city: "Ji-Paraná", at: [-61.95, -10.88] },
  RR: { city: "Rorainópolis", at: [-60.43, 0.94] },
  SC: { city: "Joinville", at: [-48.85, -26.3] },
  SP: { city: "Ribeirão Preto", at: [-47.81, -21.18] },
  SE: { city: "Itabaiana", at: [-37.42, -10.69] },
  TO: { city: "Araguaína", at: [-48.21, -7.19] },
};

const GEO = RAW_GEO as unknown as { outline: LonLat[][]; states: Record<string, LonLat[][]> };

const raw = ([lon, lat]: LonLat): [number, number] => [lon * K * COS0, -lat * K];

// The town grid's offset: the outline's middle on x = 0, its southern edge two lots north of z = 0.
const OUTLINE_RAW = GEO.outline.map((r) => r.map(raw));
const xs = OUTLINE_RAW.flat().map((p) => p[0]).concat(raw(ISLAND.at)[0]);
const zs = OUTLINE_RAW.flat().map((p) => p[1]);
const OX = -(Math.min(...xs) + Math.max(...xs)) / 2;
const OZ = -Math.max(...zs) - 2 * LOT;

/** A longitude/latitude to the town's world (x, z). */
export function project(p: LonLat): [number, number] {
  const [x, z] = raw(p);
  return [x + OX, z + OZ];
}

export type Ring = [number, number][];

/** The country's coast, in world units (biggest ring first). */
export const OUTLINE: Ring[] = GEO.outline.map((r) => r.map(project));
/** Each state's rings, in world units. */
export const STATE_RINGS: Record<UF, Ring[]> = Object.fromEntries(
  Object.entries(GEO.states).map(([uf, rings]) => [uf, rings.map((r) => r.map(project))]),
) as Record<UF, Ring[]>;

/** World bounds of the whole map, the island included. */
export const MAP_BOUNDS = (() => {
  const pts = [...OUTLINE.flat(), project(ISLAND.at)];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minZ: Math.min(...pts.map((p) => p[1])),
    maxZ: Math.max(...pts.map((p) => p[1])),
  };
})();

/** The town grid's half-width that holds the map (DriveWorld's ground and walls). */
export const MAP_H = Math.ceil(Math.max(MAP_BOUNDS.maxX, -MAP_BOUNDS.minX, -MAP_BOUNDS.minZ / 2) / LOT) + 4;

function inRing(r: Ring, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function inState(uf: UF, x: number, z: number): boolean {
  return STATE_RINGS[uf].some((r) => inRing(r, x, z));
}

/** On the mainland (inside the coast). */
export function onLand(x: number, z: number): boolean {
  return OUTLINE.some((r) => inRing(r, x, z));
}

/** Distance (world units) from a point to the coast. */
export function coastDistance(x: number, z: number): number {
  return ringsDistance(OUTLINE, x, z);
}

/** Distance (world units) from a point to the nearest edge of a state. */
export function edgeDistance(uf: UF, x: number, z: number): number {
  return ringsDistance(STATE_RINGS[uf], x, z);
}

function ringsDistance(rings: Ring[], x: number, z: number): number {
  let best = Infinity;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, az] = r[j];
      const [bx, bz] = r[i];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
  }
  return best;
}

/** A state's middle (the average of its biggest ring), in world units. */
export function stateMiddle(uf: UF): [number, number] {
  const r = STATE_RINGS[uf][0];
  return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
}

/** The big rivers (Natural Earth, public domain: brasil-rivers.json), each with its width class 1–3. */
export interface River {
  name: string;
  /** World units across. */
  width: number;
  points: Ring;
}

const RIVER_WIDTH = [0, 40, 70, 110];

export const RIVERS: River[] = (RIVERS_RAW as unknown as { rivers: { name: string; w: number; p: LonLat[] }[] }).rivers.map((r) => ({
  name: r.name,
  width: RIVER_WIDTH[r.w] ?? 40,
  points: r.p.map(project),
}));
