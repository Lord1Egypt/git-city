import { describe, expect, it } from "vitest";
import { SmashStore, columnEdges } from "./smash";

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
    const s = new SmashStore([tower]);
    // Car at the building's west edge, middle row of columns: touches column a=0.
    const hits = s.hitCircle(-19, -5, 2, 1, 0);
    expect(hits.length).toBeGreaterThan(0);
    expect(s.rows[0 + 1 * 4]).toBe(9);
    expect(s.rows[3]).toBe(10);
    expect(s.isDamaged(0)).toBe(true);
  });

  it("the cooldown keeps a car inside a column to one floor per pass", () => {
    const s = new SmashStore([tower]);
    s.hitCircle(-19, -5, 2, 1, 0, 200);
    s.hitCircle(-19, -5, 2, 1, 50, 200);
    expect(s.rows[4]).toBe(9);
    s.hitCircle(-19, -5, 2, 1, 250, 200);
    expect(s.rows[4]).toBe(8);
  });

  it("falls when every column is out, and says so on the last hit", () => {
    const s = new SmashStore([tower]);
    const hits = s.hitCircle(0, 0, 40, 10, 0);
    expect(s.standing(0)).toBe(0);
    expect(hits.filter((h) => h.down)).toHaveLength(1);
  });

  it("grows a row back per regen period, and heals fully", () => {
    const s = new SmashStore([tower], 1000);
    s.hitCircle(0, 0, 40, 3, 0);
    s.frame(2500, 0.016);
    expect(s.rows[0]).toBe(9);
    s.frame(10_000, 0.016);
    expect(s.rows[0]).toBe(10);
    expect(s.isDamaged(0)).toBe(false);
  });
});
