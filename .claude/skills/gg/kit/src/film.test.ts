import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShots, frameOf, momentOf, scenesOf, shotFor, type Take } from "./film";
import { beatOf, Transport } from "./clock";

type S = "a" | "b";
const TAKES: Take<S, string>[] = [
  ["Split", "both", "open", 4, 0],
  ["One", "a", "x", 3, 1],
  ["Two", "b", "y", 5, 0.5, 2],
];
const SHOTS = buildShots(TAKES, ["a", "b"]);
const BEAT = 0.4;

describe("buildShots", () => {
  it("lays takes end to end, a split take as one shot per stage", () => {
    expect(SHOTS.map((s) => [s.name, s.stage, s.start, s.end, s.split])).toEqual([
      ["Split", "a", 0, 4, true],
      ["Split", "b", 0, 4, true],
      ["One", "a", 4, 7, false],
      ["Two", "b", 7, 12, false],
    ]);
  });
});

describe("momentOf", () => {
  it("keeps a take's moment on its beat whatever the trim", () => {
    const one = SHOTS[2];
    // Beat 2 of One's action, which opens 1 beat in, lands 1 beat after the cut.
    expect(momentOf(one, 2)).toBe(5);
  });
});

describe("shotFor", () => {
  it("gives the take under way, with trim added to its time", () => {
    const { shot, t } = shotFor(SHOTS, "a", 5, BEAT);
    expect(shot.name).toBe("One");
    expect(t).toBeCloseTo((1 + 1) * BEAT);
  });

  it("holds a stage that's off screen on its next take's first frame", () => {
    const { shot, t } = shotFor(SHOTS, "b", 5, BEAT);
    expect(shot.name).toBe("Split");
    // Split is b's latest shot that has started; b's Two waits until beat 7.
    expect(t).toBeCloseTo(5 * BEAT);
  });

  it("freezes the picture from the freeze beat on", () => {
    const { t } = shotFor(SHOTS, "b", 11, BEAT);
    expect(t).toBeCloseTo(2 * BEAT);
  });
});

describe("frameOf", () => {
  it("is black outside the film, split on a split take, one stage otherwise", () => {
    expect(frameOf(SHOTS, -1)).toEqual({ kind: "black" });
    expect(frameOf(SHOTS, 1)).toEqual({ kind: "split" });
    expect(frameOf(SHOTS, 6)).toEqual({ kind: "full", stage: "a" });
    expect(frameOf(SHOTS, 12)).toEqual({ kind: "black" });
  });
});

describe("scenesOf", () => {
  it("lists a split take once", () => {
    expect(scenesOf(SHOTS).map((s) => s.name)).toEqual(["Split", "One", "Two"]);
  });
});

describe("Transport", () => {
  afterEach(() => vi.useRealTimers());

  it("counts beats from where it was started, and holds when paused", () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    const clock = new Transport(BEAT);
    expect(beatOf(clock)).toBe(0);
    clock.play(2);
    vi.advanceTimersByTime(BEAT * 1000 * 3);
    expect(beatOf(clock)).toBeCloseTo(5);
    clock.hold(5);
    vi.advanceTimersByTime(1000);
    expect(beatOf(clock)).toBe(5);
  });

  it("slows down without jumping", () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    const clock = new Transport(BEAT);
    clock.play(0);
    vi.advanceTimersByTime(BEAT * 1000 * 4);
    clock.speed(0.25);
    expect(beatOf(clock)).toBeCloseTo(4);
    vi.advanceTimersByTime(BEAT * 1000 * 4);
    expect(beatOf(clock)).toBeCloseTo(5);
  });
});
