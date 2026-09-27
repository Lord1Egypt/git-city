import { describe, expect, it } from "vitest";
import { RIVALRY } from "@/lib/towns/rivalry";
import { smashStoreFor } from "./smash";
import { FLOORS_PER_MINUTE, FloorBudget, SMASH_TOWNS, applyRoomDamage, blastReaches, carReaches, parseSmash, toFootprint } from "./smash-net";

const tower = {
  loginLower: "a",
  position: [100, 0, 0] as [number, number, number],
  width: 40,
  depth: 40,
  height: 60,
  floors: 10,
  windowsPerFloor: 8,
  sideWindowsPerFloor: 8,
};

describe("smash-net", () => {
  it("smashes in exactly the rivalry towns", () => {
    expect([...SMASH_TOWNS].sort()).toEqual(RIVALRY.map((r) => r.slug).sort());
  });

  it("parses only well-formed smash messages", () => {
    expect(parseSmash({ b: "a", c: [0, 3], k: "car" })).toEqual({ b: "a", c: [0, 3], k: "car" });
    expect(parseSmash({ b: "a", c: [0], k: "blast", fx: 4 })).toEqual({ b: "a", c: [0], k: "blast", fx: 4 });
    expect(parseSmash({ b: "a", c: [0], k: "blast" })).toBeNull();
    expect(parseSmash({ b: "a", c: [16], k: "car" })).toBeNull();
    expect(parseSmash({ b: "a", c: [], k: "car" })).toBeNull();
    expect(parseSmash({ b: "a", c: [1.5], k: "car" })).toBeNull();
  });

  it("a car reaches only the columns near it; a blast reaches a missile's range", () => {
    const s = smashStoreFor([tower]);
    const all = Array.from({ length: 16 }, (_, c) => c);
    // Car (meters) at the building's west edge: 80 units = 32 m.
    expect(carReaches(s, 0, all, 32, 0).length).toBeGreaterThan(0);
    expect(carReaches(s, 0, all, 32, 0).length).toBeLessThan(16);
    expect(carReaches(s, 0, all, -200, 0)).toEqual([]);
    expect(blastReaches(s, 0, all, 0, 0)).toHaveLength(16);
    expect(blastReaches(s, 0, all, -400, 0)).toEqual([]);
    expect(toFootprint(s, 0, 100, 0)).toBe(0);
    expect(toFootprint(s, 0, 70, 0)).toBe(10);
  });

  it("caps each driver's floors per minute", () => {
    const b = new FloorBudget();
    expect(b.take(FLOORS_PER_MINUTE - 2, 0)).toBe(FLOORS_PER_MINUTE - 2);
    expect(b.take(5, 1000)).toBe(2);
    expect(b.take(5, 2000)).toBe(0);
    expect(b.take(5, 61_000)).toBe(5);
  });
});

describe("applyRoomDamage", () => {
  it("takes the room's rows, names the attacker, and returns only columns that lost floors", () => {
    const s = smashStoreFor([tower]);
    const lost = applyRoomDamage(s, { t: "damage", b: "a", r: [9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] }, 0);
    expect(lost).toEqual([{ target: 0, col: 0 }]);
    // Your own predicted hit: the room's copy changes nothing, no second burst.
    expect(applyRoomDamage(s, { t: "damage", b: "a", r: s.rowsOf(0) }, 1)).toEqual([]);
    applyRoomDamage(s, { t: "damage", b: "a", r: Array(16).fill(0), by: "x" }, 2);
    expect(s.demolishedBy.get(0)).toBe("x");
  });

  it("the full list heals every damaged building it leaves out", () => {
    const s = smashStoreFor([tower]);
    s.hitColumns(0, [0], 3, 0);
    applyRoomDamage(s, { t: "damage_all", list: [] }, 1);
    expect(s.isDamaged(0)).toBe(false);
  });
});
