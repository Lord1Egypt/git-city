import { describe, expect, it } from "vitest";
import { placeLine } from "./place";

describe("placeLine", () => {
  it("names the town just above and the gap", () => {
    expect(placeLine({ rank: 3, total: 12, coding: 5, gap: 40, above: "Acme" })).toBe("3rd of 12 towns · 40 behind Acme Town");
  });

  it("shows the lead at first place", () => {
    expect(placeLine({ rank: 1, total: 12, coding: 5, gap: 12, above: null })).toBe("1st of 12 towns · 12 ahead");
    expect(placeLine({ rank: 1, total: 1, coding: 3, gap: null, above: null })).toBe("1st of 1 town");
  });

  it("says tied on a zero gap", () => {
    expect(placeLine({ rank: 2, total: 4, coding: 3, gap: 0, above: "Acme" })).toBe("2nd of 4 towns · tied with Acme Town");
  });

  it("counts toward the minimum while unranked", () => {
    expect(placeLine({ rank: null, total: 12, coding: 2, gap: null, above: null })).toBe("2 of 3 coding to rank");
    expect(placeLine({ rank: null, total: 0, coding: 0, gap: null, above: null })).toBe("0 of 3 coding to rank");
  });
});
