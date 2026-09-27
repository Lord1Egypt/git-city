import { describe, expect, it } from "vitest";
import { columnEdges, smashStoreFor } from "./smash";

const tower = {
  loginLower: "a",
  position: [0, 0, 0] as [number, number, number],
  width: 40,
  depth: 40,
  height: 60,
  floors: 10,
  windowsPerFloor: 8,
  sideWindowsPerFloor: 8,
};

describe("columnEdges", () => {
  it("cuts on window lines, at most 4 columns", () => {
    expect(columnEdges(8)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(columnEdges(3)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(columnEdges(6)).toEqual([0, 2 / 6, 3 / 6, 5 / 6, 1]);
    expect(columnEdges(1)).toEqual([0, 1]);
  });
});

describe("SmashStore", () => {
  it("a pass takes the bottom floor of the columns the car touches, only those", () => {
    const s = smashStoreFor([tower]);
    // Car at the building's west edge, middle row of columns: touches column a=0.
    const hits = s.hitCircle(-19, -5, 2, 1, 0);
    expect(hits.length).toBeGreaterThan(0);
    expect(s.rows[0 + 1 * 4]).toBe(9);
    expect(s.rows[3]).toBe(10);
    expect(s.isDamaged(0)).toBe(true);
  });

  it("the cooldown keeps a car inside a column to one floor per pass", () => {
    const s = smashStoreFor([tower]);
    s.hitCircle(-19, -5, 2, 1, 0, 200);
    s.hitCircle(-19, -5, 2, 1, 50, 200);
    expect(s.rows[4]).toBe(9);
    s.hitCircle(-19, -5, 2, 1, 250, 200);
    expect(s.rows[4]).toBe(8);
  });

  it("falls when every column is out, and says so on the last hit", () => {
    const s = smashStoreFor([tower]);
    const hits = s.hitCircle(0, 0, 40, 10, 0);
    expect(s.standing(0)).toBe(0);
    expect(hits.filter((h) => h.down)).toHaveLength(1);
  });

  it("grows a row back per regen period, and heals fully", () => {
    const s = smashStoreFor([tower], 1000);
    s.hitCircle(0, 0, 40, 3, 0);
    s.frame(2500, 0.016);
    expect(s.rows[0]).toBe(9);
    s.frame(10_000, 0.016);
    expect(s.rows[0]).toBe(10);
    expect(s.isDamaged(0)).toBe(false);
  });

  it("loads saved damage with the floors grown back since, by time and by contributions", () => {
    const s = smashStoreFor([tower], 1000);
    s.load([{ login: "a", rows: Array(16).fill(2), regenFrom: 0, contribBase: 10, contribNow: 13, demolishedBy: null }], 2500);
    // 2 left + 3 contributions + 2 hours (periods) = 7.
    expect(s.rows[0]).toBe(7);
    expect(s.shown[0]).toBe(7);
    expect(s.isDamaged(0)).toBe(true);
    expect(s.regenFrom(0)).toBe(2000);
  });

  it("takes the room's rows: fewer drop into the gap, all full heals", () => {
    const s = smashStoreFor([tower]);
    s.setRows(0, Array(16).fill(7), 100);
    expect(s.rows[5]).toBe(7);
    expect(s.drop[5]).toBe(3);
    expect(s.isDamaged(0)).toBe(true);
    s.setRows(0, Array(16).fill(10), 200);
    expect(s.isDamaged(0)).toBe(false);
  });

  it("the room applies hits by column, names who took the last floor, and saves only what changed", () => {
    const s = smashStoreFor([tower]);
    s.takeChanged();
    expect(s.hitColumns(0, [0, 1, 99, 1], 3, 0, "x")).toEqual({ took: 6, down: false });
    expect(s.takeChanged()).toEqual([0]);
    const r = s.hitColumns(0, Array.from({ length: 16 }, (_, c) => c), 10, 0, "killer");
    expect(r.down).toBe(true);
    expect(s.snapshot()[0].demolishedBy).toBe("killer");
    s.regrow(0, 10);
    expect(s.isDamaged(0)).toBe(false);
    expect(s.demolishedBy.size).toBe(0);
  });
});

describe("standingHeight", () => {
  it("is the tallest column left, a floor of rubble at least", () => {
    const s = smashStoreFor([tower]);
    s.hitColumns(0, Array.from({ length: 16 }, (_, c) => c), 7, 0);
    expect(s.standingHeight(0)).toBe(3 * 6);
    s.hitColumns(0, Array.from({ length: 16 }, (_, c) => c), 10, 0);
    expect(s.standingHeight(0)).toBe(6);
  });
});
