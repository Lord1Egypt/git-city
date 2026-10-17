import { describe, expect, it } from "vitest";
import { LOT } from "../league-city/grid";
import { MAP_BOUNDS, OUTLINE, STATE_RINGS, coastDistance, inState, onLand } from "./brasil-geo";
import { CITY, STATES, layoutBrasil, parseUF, ranking, type MapDev, type UF } from "./brasil-map";

const devs = (spec: [UF | null, number][]): MapDev[] => {
  let id = 0;
  return spec.flatMap(([uf, n]) => Array.from({ length: n }, () => ({ id: ++id, login: `dev${id}`, uf })));
};

describe("brasil geography", () => {
  it("has the coast and all 27 states, north up, south of the town's entrance row", () => {
    expect(OUTLINE[0].length).toBeGreaterThan(100);
    expect(Object.keys(STATE_RINGS)).toHaveLength(27);
    expect(MAP_BOUNDS.maxZ).toBeLessThan(0);
    // Roraima (far north) is north of Rio Grande do Sul (far south): smaller z.
    const z = (uf: UF) => STATE_RINGS[uf][0][0][1];
    expect(z("RR")).toBeLessThan(z("RS"));
  });
});

describe("brasil cities", () => {
  it("reads a state's sigla from a comment", () => {
    expect(parseUF("sp")).toBe("SP");
    expect(parseUF(" RJ ")).toBe("RJ");
    expect(parseUF("XX")).toBeNull();
  });

  it("puts every state's square on land, near its capital, even with nobody there", () => {
    const l = layoutBrasil([]);
    expect(l.cities).toHaveLength(27);
    for (const c of l.cities) expect(onLand(c.center[0] * LOT, c.center[1] * LOT)).toBe(true);
    // Most empty squares sit in their own state (the map isn't to scale: a few small ones spill over).
    expect(l.cities.filter((c) => inState(c.uf!, c.center[0] * LOT, c.center[1] * LOT)).length).toBeGreaterThan(20);
  });

  it("keeps every building on its own lot, on land, never on a street or a highway", () => {
    const l = layoutBrasil(devs([["SP", 300], ["RJ", 80], ["SE", 40], ["PB", 30], ["PE", 30], [null, 20]]));
    const taken = new Set<string>();
    const streets = new Set([...l.cities.flatMap((c) => c.roads.map((r) => r.join())), ...l.highways.map((r) => r.join())]);
    for (const c of l.cities) {
      for (const d of c.devs) {
        const k = `${d.x},${d.z}`;
        expect(taken.has(k)).toBe(false);
        expect(streets.has(k)).toBe(false);
        expect(onLand(d.x * LOT, d.z * LOT)).toBe(true);
        taken.add(k);
      }
    }
    expect(l.cities.find((c) => c.uf === "SP")?.devs).toHaveLength(300);
    expect(l.cities.find((c) => c.uf === "SE")?.devs).toHaveLength(40);
    expect(l.island.devs).toHaveLength(20);
  });

  it("links every capital to a neighbor by highway", () => {
    const l = layoutBrasil([]);
    expect(l.highways.length).toBeGreaterThan(200);
  });

  it("keeps the island out at sea, clear of the coast however big it gets, with no avenues", () => {
    for (const n of [0, 50, 600]) {
      const { island } = layoutBrasil(devs([[null, n]]));
      const [x, z] = island.hub;
      expect(coastDistance(x * LOT, z * LOT)).toBeGreaterThan((island.radius + CITY.islandSea - 2) * LOT);
      expect(onLand(x * LOT, z * LOT)).toBe(false);
      expect(island.devs).toHaveLength(n);
    }
  });

  it("makes the first dev the founder, next to the square", () => {
    const l = layoutBrasil(devs([["BA", 5]]));
    const ba = l.cities.find((c) => c.uf === "BA")!;
    expect(ba.devs[0]).toMatchObject({ founder: true, dev: { id: 1 } });
    expect(Math.max(Math.abs(ba.devs[0].x - ba.center[0]), Math.abs(ba.devs[0].z - ba.center[1]))).toBe(1);
    expect(ba.devs.filter((d) => d.founder)).toHaveLength(1);
  });

  it("leaves lawn between buildings, so there's room to drive", () => {
    const l = layoutBrasil(devs([["MG", 200]]));
    const mg = l.cities.find((c) => c.uf === "MG")!;
    expect(mg.lawns.length).toBeGreaterThan(mg.devs.length * 0.3);
  });

  it("grows a city outward as devs arrive", () => {
    const small = layoutBrasil(devs([["GO", 10]])).cities.find((c) => c.uf === "GO")!;
    const big = layoutBrasil(devs([["GO", 400]])).cities.find((c) => c.uf === "GO")!;
    expect(big.radius).toBeGreaterThan(small.radius * 2);
    expect(big.roads.length).toBeGreaterThan(small.roads.length);
  });

  it("ranks states by devs", () => {
    const l = layoutBrasil(devs([["RJ", 3], ["SP", 5], ["AC", 1]]));
    expect(ranking(l).map((r) => r.uf)).toEqual(["SP", "RJ", "AC"]);
    expect(STATES).toHaveLength(27);
  });
});
