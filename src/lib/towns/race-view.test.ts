import { describe, expect, it } from "vitest";
import { crewSummary, dayIndex, dayLevel, townsAround } from "./race-view";

const towns = (n: number) => Array.from({ length: n }, (_, i) => ({ league_id: `t${i + 1}` }));

describe("townsAround", () => {
  it("shows the leader, the one above, yours and the one below", () => {
    const { rows, gapBefore } = townsAround(towns(12), "t5");
    expect(rows.map((r) => r.league_id)).toEqual(["t1", "t4", "t5", "t6"]);
    expect([...gapBefore]).toEqual(["t4"]);
  });

  it("has no gap near the top and no row below the last", () => {
    expect(townsAround(towns(3), "t2").rows.map((r) => r.league_id)).toEqual(["t1", "t2", "t3"]);
    expect(townsAround(towns(3), "t3").rows.map((r) => r.league_id)).toEqual(["t1", "t2", "t3"]);
    expect(townsAround(towns(1), "t1").rows.map((r) => r.league_id)).toEqual(["t1"]);
  });

  it("shows the top 3 when your town isn't ranked", () => {
    expect(townsAround(towns(8), "zz").rows.map((r) => r.league_id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("crewSummary", () => {
  const s = (login: string, total: number) => ({ login, total });
  const crew = [s("a", 90), s("b", 80), s("c", 70), s("d", 60), s("me", 50), s("e", 0), s("f", 0)];

  it("keeps the top 3 and adds you below them", () => {
    const r = crewSummary(crew, "ME");
    expect(r.top.map((x) => x.login)).toEqual(["a", "b", "c"]);
    expect(r.you).toEqual({ row: s("me", 50), rank: 5 });
    expect(r.rest).toBe(3);
    expect(r.idle).toBe(2);
  });

  it("doesn't repeat you inside the top or add you when you didn't code", () => {
    expect(crewSummary(crew, "b").you).toBeNull();
    expect(crewSummary(crew, "e").you).toBeNull();
    expect(crewSummary(crew, null).you).toBeNull();
  });
});

describe("dayIndex and dayLevel", () => {
  it("starts the week on Monday, in UTC", () => {
    expect(dayIndex(new Date("2026-09-21T00:00:00Z"))).toBe(0);
    expect(dayIndex(new Date("2026-09-27T23:59:00Z"))).toBe(6);
  });

  it("shades days like GitHub", () => {
    expect([0, 1, 5, 15, 40, 100].map(dayLevel)).toEqual([0, 1, 2, 3, 4, 4]);
  });
});
