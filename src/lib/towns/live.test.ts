import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEARTBEAT_MS, LIVE_STALE_MS, REPORT_MIN_MS, createReporter, liveSnapshot, parseReport, sortByLive, type LiveEntry, type TownLive } from "./live";

describe("town live counts", () => {
  it("takes only well-formed reports", () => {
    expect(parseReport({ slug: "claude-code-town", driving: 2, watching: 5 })).toEqual({ slug: "claude-code-town", driving: 2, watching: 5 });
    expect(parseReport({ slug: "Bad Slug", driving: 1, watching: 0 })).toBeNull();
    expect(parseReport({ slug: "x", driving: -1, watching: 0 })).toBeNull();
    expect(parseReport({ slug: "x", driving: 1.5, watching: 0 })).toBeNull();
    expect(parseReport(null)).toBeNull();
  });

  it("lists busy towns with a fresh count, busiest first", () => {
    const e = new Map<string, LiveEntry>([
      ["a", { driving: 1, watching: 0, at: 1000 }],
      ["b", { driving: 2, watching: 3, at: 1000 }],
      ["empty", { driving: 0, watching: 0, at: 1000 }],
      ["gone", { driving: 9, watching: 9, at: 1000 - LIVE_STALE_MS }],
    ]);
    const snap = liveSnapshot(e, 1000);
    expect(Object.keys(snap)).toEqual(["b", "a"]);
    expect(snap.b).toEqual({ driving: 2, watching: 3 });
  });

  it("floats towns with people to the top and keeps the rest in order", () => {
    const towns = [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "d" }];
    const live = { c: { driving: 1, watching: 0 }, d: { driving: 2, watching: 2 } };
    expect(sortByLive(towns, live).map((t) => t.slug)).toEqual(["d", "c", "a", "b"]);
  });
});

describe("drive room reporter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const sent: TownLive[] = [];
    const r = createReporter((l) => sent.push(l), () => Date.now());
    return { sent, r };
  };

  it("sends the first change now, then batches to one report per window", () => {
    const { sent, r } = setup();
    r.update({ driving: 1, watching: 0 });
    r.update({ driving: 2, watching: 0 });
    r.update({ driving: 3, watching: 1 });
    expect(sent).toEqual([{ driving: 1, watching: 0 }]);
    vi.advanceTimersByTime(REPORT_MIN_MS);
    expect(sent).toEqual([{ driving: 1, watching: 0 }, { driving: 3, watching: 1 }]);
  });

  it("skips a change that comes back to what was sent", () => {
    const { sent, r } = setup();
    r.update({ driving: 1, watching: 0 });
    r.update({ driving: 2, watching: 0 });
    r.update({ driving: 1, watching: 0 });
    vi.advanceTimersByTime(REPORT_MIN_MS);
    expect(sent).toHaveLength(1);
  });

  it("says empty right away and stops the heartbeat", () => {
    const { sent, r } = setup();
    r.update({ driving: 1, watching: 0 });
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(sent).toHaveLength(2); // heartbeat
    r.update({ driving: 0, watching: 0 });
    expect(sent.at(-1)).toEqual({ driving: 0, watching: 0 });
    vi.advanceTimersByTime(HEARTBEAT_MS * 3);
    expect(sent).toHaveLength(3);
  });
});
