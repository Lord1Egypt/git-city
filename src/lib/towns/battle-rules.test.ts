import { describe, expect, it } from "vitest";
import { townScore } from "@/lib/leagues/scoring";
import { battlePhase, battleWeekNumber, dayWinners, finishedDays, seriesRecord, weekWinner } from "./battle-rules";
import { BATTLE_START } from "./rivalry";

describe("battlePhase", () => {
  it("picks sides until the first battle Monday", () => {
    expect(battlePhase(BATTLE_START - 1)).toBe("pick");
    expect(battlePhase(BATTLE_START)).toBe("live");
  });
});

describe("weekWinner", () => {
  it("goes to the higher per dev", () => {
    expect(weekWinner({ perDev: 84, coding: 40 }, { perDev: 61, coding: 90 })).toBe("claude");
    expect(weekWinner({ perDev: 12, coding: 3 }, { perDev: 13, coding: 3 })).toBe("codex");
  });

  it("is nobody's on a tie", () => {
    expect(weekWinner({ perDev: 50, coding: 3 }, { perDev: 50, coding: 9 })).toBeNull();
  });

  it("can't go to a side under 3 coders", () => {
    // Two huge coders don't make a score; the other side wins by default.
    const small = townScore([900, 800]);
    const big = townScore([5, 4, 3]);
    expect(small).toBeNull();
    expect(weekWinner(small, big)).toBe("codex");
    expect(weekWinner(big, small)).toBe("claude");
    expect(weekWinner(null, null)).toBeNull();
  });
});

describe("dayWinners", () => {
  it("marks finished days only, ties for nobody", () => {
    const claude = [10, 5, 7, 0, 0, 0, 0];
    const codex = [8, 5, 9, 0, 0, 0, 0];
    expect(dayWinners(claude, codex, 3)).toEqual(["claude", null, "codex", "open", "open", "open", "open"]);
  });

  it("gives a day nobody coded to nobody", () => {
    expect(dayWinners([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], 7)).toEqual([null, null, null, null, null, null, null]);
  });
});

describe("finishedDays", () => {
  const monday = new Date("2026-10-12T00:00:00Z");
  it("counts whole days since Monday", () => {
    expect(finishedDays(monday, Date.parse("2026-10-12T15:00:00Z"))).toBe(0);
    expect(finishedDays(monday, Date.parse("2026-10-14T00:00:00Z"))).toBe(2);
    expect(finishedDays(monday, Date.parse("2026-10-25T00:00:00Z"))).toBe(7);
  });
});

describe("seriesRecord", () => {
  it("counts week wins, skipping ties", () => {
    expect(seriesRecord(["claude", null, "codex", "claude"])).toEqual({ claude: 2, codex: 1 });
  });
});

describe("battleWeekNumber", () => {
  it("counts from the first battle Monday", () => {
    expect(battleWeekNumber("2026-10-12")).toBe(1);
    expect(battleWeekNumber("2026-10-19")).toBe(2);
  });
});
