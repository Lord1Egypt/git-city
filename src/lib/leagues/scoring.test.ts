import { describe, expect, it } from "vitest";
import {
  dayContributions,
  detectOvertakes,
  isoDay,
  rankStandings,
  rankTowns,
  townDays,
  townScore,
  weekContributions,
  weekDays,
  weekEnd,
  weekStart,
  type StandingInput,
} from "./scoring";

describe("weekContributions", () => {
  it("sums raw contributions", () => {
    expect(
      weekContributions([
        { day: "2026-09-21", contributions: 3 },
        { day: "2026-09-22", contributions: 40 },
      ]),
    ).toBe(43);
  });

  it("caps each day at 100", () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ day: `2026-09-2${i + 1}`, contributions: 250 }));
    expect(weekContributions(days)).toBe(700);
    expect(weekContributions([{ day: "2026-09-21", contributions: 100 }])).toBe(100);
  });

  it("ignores negative and fractional counts", () => {
    expect(weekContributions([{ day: "2026-09-21", contributions: -4 }])).toBe(0);
    expect(weekContributions([{ day: "2026-09-21", contributions: 2.9 }])).toBe(2);
  });
});

describe("dayContributions and townDays", () => {
  const week = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];

  it("puts each day in its slot, capped, with missing days at 0", () => {
    expect(dayContributions([{ day: "2026-09-23", contributions: 250 }, { day: "2026-09-21", contributions: 4 }], week)).toEqual([4, 0, 100, 0, 0, 0, 0]);
  });

  it("averages each day over the members who coded that week", () => {
    expect(townDays([[10, 0, 0, 0, 0, 0, 0], [20, 6, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]])).toEqual([15, 3, 0, 0, 0, 0, 0]);
  });
});

describe("townScore", () => {
  it("is null under 3 members coding", () => {
    expect(townScore([100, 200])).toBeNull();
    expect(townScore([100, 200, 0, 0, 0])).toBeNull();
    expect(townScore([])).toBeNull();
  });

  it("averages only members who coded", () => {
    expect(townScore([100, 200, 300, 0, 0])).toEqual({ perDev: 200, coding: 3 });
  });

  it("rounds the average", () => {
    expect(townScore([1, 1, 2])).toEqual({ perDev: 1, coding: 3 });
    expect(townScore([1, 2, 2])).toEqual({ perDev: 2, coding: 3 });
  });
});

describe("rankTowns", () => {
  const t = (id: string, perDev: number | null, coding = 3, created_at: string | null = null) => ({
    id,
    created_at,
    score: perDev === null ? null : { perDev, coding },
  });

  it("drops unranked towns and sorts by per-dev average", () => {
    const r = rankTowns([t("a", 50), t("b", null), t("c", 90)]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ["c", 1],
      ["a", 2],
    ]);
  });

  it("breaks ties by more members coding, then the older town", () => {
    const r = rankTowns([
      t("a", 80, 3, "2026-09-01T00:00:00Z"),
      t("b", 80, 5, "2026-09-10T00:00:00Z"),
      t("c", 80, 3, "2026-08-01T00:00:00Z"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});

describe("weekStart", () => {
  it("maps Sunday 23:59 UTC to the Monday before", () => {
    expect(isoDay(weekStart(new Date("2026-09-27T23:59:59Z")))).toBe("2026-09-21");
  });

  it("maps Monday 00:00 UTC to the same Monday", () => {
    expect(isoDay(weekStart(new Date("2026-09-28T00:00:00Z")))).toBe("2026-09-28");
  });

  it("uses UTC, not local time", () => {
    expect(isoDay(weekStart(new Date("2026-09-27T23:30:00-03:00")))).toBe("2026-09-28");
  });

  it("has a 7-day exclusive end", () => {
    const start = weekStart(new Date("2026-09-23T10:00:00Z"));
    expect(weekEnd(start).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(weekDays(start)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });
});

describe("rankStandings", () => {
  const entry = (id: number, total: number, joined: string | null): StandingInput => ({
    developer_id: id,
    total,
    joined_at: joined,
  });

  it("sorts by total", () => {
    const r = rankStandings([entry(1, 10, null), entry(2, 30, null)]);
    expect(r.map((e) => [e.developer_id, e.rank])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it("breaks ties by earlier joined_at", () => {
    const r = rankStandings([
      entry(1, 50, "2026-01-01T00:00:00Z"),
      entry(2, 50, "2026-06-01T00:00:00Z"),
      entry(3, 50, "2025-12-01T00:00:00Z"),
    ]);
    expect(r.map((e) => e.developer_id)).toEqual([3, 1, 2]);
  });

  it("puts a missing joined_at last on a full tie", () => {
    const r = rankStandings([entry(1, 5, null), entry(2, 5, "2026-01-01T00:00:00Z")]);
    expect(r.map((e) => e.developer_id)).toEqual([2, 1]);
  });
});

describe("detectOvertakes", () => {
  const snap = (rows: [number, number][]) =>
    rankStandings(
      rows.map(([id, total]) => ({ developer_id: id, total, joined_at: null, login: `u${id}` })),
    );

  it("reports who passed you", () => {
    const o = detectOvertakes(snap([[1, 100], [2, 50]]), snap([[1, 100], [2, 140]]));
    expect(o).toEqual([{ developerId: 1, overtakerLogin: "u2", gap: 40, newRank: 2 }]);
  });

  it("stays quiet when nothing changed", () => {
    expect(detectOvertakes(snap([[1, 100], [2, 50]]), snap([[1, 110], [2, 60]]))).toEqual([]);
  });

  it("ignores passes below the top 5 when you kept your rank", () => {
    const base: [number, number][] = [[1, 900], [2, 800], [3, 700], [4, 600], [5, 500], [6, 400], [7, 300], [8, 200]];
    const prev = snap(base);
    // 8 jumps over 7 and 6; 6 drops to 7th, 7 drops to 8th.
    const next = snap([...base.slice(0, 7), [8, 450]]);
    const ids = detectOvertakes(prev, next).map((o) => o.developerId);
    expect(ids).toEqual([6, 7]);
  });

  it("names the closest passer", () => {
    const o = detectOvertakes(snap([[1, 100], [2, 50], [3, 40]]), snap([[1, 100], [2, 300], [3, 200]]));
    expect(o.find((x) => x.developerId === 1)?.overtakerLogin).toBe("u3");
  });
});
