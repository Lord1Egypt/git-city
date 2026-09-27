import { describe, expect, it } from "vitest";
import { champions, gridWeeks, monumentWeeks, type HallWeek } from "./hall";

const w = (week_start: string, login: string | null, monument = false): HallWeek => ({
  week_start,
  winner: login ? { login, avatar_url: null } : null,
  monument,
});

const weeks = [w("2026-09-21", "ana", true), w("2026-09-14", "bruno"), w("2026-09-07", "ana"), w("2026-08-31", null), w("2026-08-24", "caio", true)];

describe("champions", () => {
  it("counts crowns and keeps each member's weeks", () => {
    const c = champions(weeks);
    expect(c.map((x) => [x.login, x.crowns])).toEqual([
      ["ana", 2],
      ["bruno", 1],
      ["caio", 1],
    ]);
    expect([...c[0].weeks]).toEqual(["2026-09-21", "2026-09-07"]);
  });

  it("breaks crown ties by the most recent win", () => {
    expect(champions(weeks).slice(1).map((x) => x.login)).toEqual(["bruno", "caio"]);
  });
});

describe("gridWeeks and monumentWeeks", () => {
  it("keeps the last n weeks, oldest first", () => {
    expect(gridWeeks(weeks, 3)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
  });

  it("collects the monument weeks", () => {
    expect([...monumentWeeks(weeks)]).toEqual(["2026-09-21", "2026-08-24"]);
  });
});
