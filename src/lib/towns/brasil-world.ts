// ─── Brasil town: the world's objects ───────────────────────
// Everything the scene draws from a layout (brasil-map.ts), as town objects
// (lib/league-city/types), so the towns' renderers and drive mode take them
// as they are: streets and highways, a building per dev, a fountain in every
// square, a lamp on every block's corners, trees along the sidewalks and on
// the lawns, a strip of woods round every city, copses out in the country,
// palms round the island, and the leading state's blimp. Deterministic for
// a seed, so the same devs give the same map.

import type { CityBuilding } from "../github";
import { LOT } from "../league-city/grid";
import { faceRoad, lotKey } from "../league-city/placement";
import type { CityObject, TreeType } from "../league-city/types";
import { STATE_RINGS, inState, onLand } from "./brasil-geo";
import { CITY, ranking, type BrasilLayout, type MapDev, type UF } from "./brasil-map";

const STREET_TREES: TreeType[] = ["tree_default", "tree_oak", "tree_detailed"];
const LAWN_TREES: TreeType[] = ["tree_default", "tree_oak", "tree_fat", "tree_palm_tall", "tree_detailed"];
const WOODS: TreeType[] = ["tree_default", "tree_oak", "tree_fat", "tree_pine_tall_a", "tree_detailed"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

export interface BrasilWorld {
  objects: CityObject[];
  /** Each dev's building, as the town's renderers take it (lots placed by leagueBuildings). */
  byDevId: Map<number, CityBuilding>;
}

/**
 * The world's objects. `building` gives a dev's building (sized by their
 * contributions); the lots come from the layout.
 */
export function brasilWorld(layout: BrasilLayout, building: (dev: MapDev, founder: boolean) => CityBuilding, seed = 1): BrasilWorld {
  const rand = rng(seed);
  const objects: CityObject[] = [];
  const byDevId = new Map<number, CityBuilding>();
  const item = (id: string, type: CityObject["item_type"], x: number, z: number, extra: Partial<CityObject> = {}) =>
    objects.push({ id, kind: "item", item_type: type, developer_id: null, x, z, px: null, pz: null, rot: 0, is_new: false, ...extra });
  const tree = (id: string, types: TreeType[], wx: number, wz: number) =>
    item(id, types[Math.floor(rand() * types.length)], Math.round(wx / LOT), Math.round(wz / LOT), { px: wx, pz: wz, rot: Math.floor(rand() * 360) });

  const all = [...layout.cities, layout.island];
  // Every lot a city or a highway uses: the woods stay off them.
  const built = new Set<string>(layout.highways.map(([x, z]) => lotKey(x, z)));
  for (const c of all) {
    for (const [x0, z0] of c.blocks) for (let x = x0 - 1; x <= x0 + CITY.block; x++) for (let z = z0 - 1; z <= z0 + CITY.block; z++) built.add(lotKey(x, z));
    for (const [x, z] of c.roads) built.add(lotKey(x, z));
  }

  layout.highways.forEach(([x, z], i) => item(`h${i}`, "road", x, z));
  for (const city of all) {
    const tag = city.uf ?? "isl";
    const roads = new Set(city.roads.map(([x, z]) => lotKey(x, z)));
    city.roads.forEach(([x, z], i) => item(`r-${tag}-${i}`, "road", x, z));
    for (const d of city.devs) {
      objects.push({ id: `b${d.dev.id}`, kind: "building", item_type: null, developer_id: d.dev.id, x: d.x, z: d.z, px: null, pz: null, rot: faceRoad(roads, d.x, d.z), is_new: false });
      byDevId.set(d.dev.id, building(d.dev, d.founder));
    }
    item(`f-${tag}`, "fountain", city.center[0], city.center[1], { px: city.center[0] * LOT, pz: city.center[1] * LOT });

    city.blocks.forEach(([x0, z0], i) => {
      // The block's edges (world): lamps on the corners, trees along the sidewalk between lots.
      const w0 = (x0 - 0.5) * LOT;
      const n0 = (z0 - 0.5) * LOT;
      const side = LOT * CITY.block;
      const inset = 5;
      [[inset, inset], [side - inset, inset], [inset, side - inset], [side - inset, side - inset]].forEach(([dx, dz], k) =>
        item(`l-${tag}-${i}-${k}`, "lamp", Math.round((w0 + dx) / LOT), Math.round((n0 + dz) / LOT), { px: w0 + dx, pz: n0 + dz, rot: k * 90 }),
      );
      for (let k = 1; k < CITY.block; k++) {
        const along = k * LOT;
        tree(`st-${tag}-${i}-${k}-n`, STREET_TREES, w0 + along, n0 + inset);
        tree(`st-${tag}-${i}-${k}-s`, STREET_TREES, w0 + along, n0 + side - inset);
        tree(`st-${tag}-${i}-${k}-w`, STREET_TREES, w0 + inset, n0 + along);
        tree(`st-${tag}-${i}-${k}-e`, STREET_TREES, w0 + side - inset, n0 + along);
      }
    });
    // Lawns: a tree or two, off center.
    city.lawns.forEach(([x, z], i) => {
      if (rand() < 0.3) return;
      tree(`t-${tag}-${i}`, LAWN_TREES, x * LOT + (rand() - 0.5) * 22, z * LOT + (rand() - 0.5) * 22);
      if (rand() < 0.4) tree(`t2-${tag}-${i}`, LAWN_TREES, x * LOT + (rand() - 0.5) * 30, z * LOT + (rand() - 0.5) * 30);
    });
  }

  // A strip of woods round every mainland city, on open land.
  for (const city of layout.cities) {
    const [hx, hz] = city.hub;
    const r0 = city.radius + 2;
    const r1 = city.radius + 5;
    const ring = Math.ceil(2 * Math.PI * r1 * 1.3);
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2 + rand() * 0.05;
      const r = r0 + rand() * (r1 - r0);
      const wx = (hx + Math.cos(a) * r) * LOT;
      const wz = (hz + Math.sin(a) * r) * LOT;
      const lot = lotKey(Math.round(wx / LOT), Math.round(wz / LOT));
      if (built.has(lot) || !onLand(wx, wz)) continue;
      tree(`wd-${city.uf}-${k}`, WOODS, wx, wz);
    }
  }

  // Copses out in the country, clear of the cities.
  for (const city of layout.cities) {
    const uf = city.uf as UF;
    const ring = STATE_RINGS[uf][0];
    const xs = ring.map((p) => p[0]);
    const zs = ring.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const copses = Math.min(30, Math.max(5, Math.round(((x1 - x0) * (z1 - z0)) / 1.2e6)));
    for (let k = 0, tries = 0; k < copses && tries < copses * 8; tries++) {
      const wx = x0 + rand() * (x1 - x0);
      const wz = z0 + rand() * (z1 - z0);
      if (!inState(uf, wx, wz) || built.has(lotKey(Math.round(wx / LOT), Math.round(wz / LOT)))) continue;
      k++;
      for (let t = 0; t < 6; t++) tree(`w-${uf}-${k}-${t}`, WOODS, wx + (rand() - 0.5) * 180, wz + (rand() - 0.5) * 180);
    }
  }

  // Palms round the island's shore.
  {
    const isl = layout.island;
    const r = (isl.radius + 1) * LOT;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2 + rand() * 0.15;
      tree(`p-${k}`, ["tree_palm_tall"], isl.hub[0] * LOT + Math.cos(a) * r, isl.hub[1] * LOT + Math.sin(a) * r);
    }
  }

  const top = ranking(layout)[0];
  if (top) {
    const lead = layout.cities.find((c) => c.uf === top.uf)!;
    const [x, z] = lead.center;
    item("blimp-lead", "blimp", x, z, { px: x * LOT, pz: z * LOT, props: { text: `${top.uf} LIDERA · ${top.devs} DEVS`, color: "#c8e64a", bg: "#0b0f19", alt: 220 } });
  }
  return { objects, byDevId };
}
