import { describe, expect, it } from "vitest";
import { SPRINT, WALL_OFFSET, arcDelta, buildTrack, locate, pointAt, type TrackSpec } from "./track";
import { curbRuns, wallSegments } from "./layout";

function fingerprint(spec: TrackSpec = SPRINT) {
  const t = buildTrack(spec);
  let h = 0;
  for (const p of t.samples) h = (h * 31 + Math.round(p.x * 1000) + Math.round(p.z * 7000) + Math.round(p.k * 1e6)) % 1_000_000_007;
  return { t, h };
}

describe("the town track (sprint)", () => {
  it("is the same track it was before tracks became specs", () => {
    const { t, h } = fingerprint();
    expect(t.samples.length).toBe(371);
    expect(t.length).toBe(742);
    expect(t.checkpoints.length).toBe(19);
    expect(h).toBe(608725508);
    expect(t.grid[0].x).toBeCloseTo(-18.599002070764108, 9);
    expect(t.grid[0].z).toBeCloseTo(80.6, 9);
    expect(WALL_OFFSET).toBe(11.5);
    expect(wallSegments(t).length).toBe(248);
    expect(curbRuns(t)).toEqual([[86, 532], [626, 686]]);
  });
});

// A short S-shaped run: straight, a left, a right, straight to the finish.
const RUN: TrackSpec = {
  ...SPRINT,
  id: "test-run",
  closed: false,
  points: [
    [0, 0], [0, 20], [0, 40], [10, 60], [30, 70], [50, 80], [60, 100], [60, 120], [60, 140],
  ],
};

describe("an open track (a run)", () => {
  const t = buildTrack(RUN);

  it("starts on its first point and ends on its last", () => {
    expect(t.closed).toBe(false);
    expect(t.samples[0].x).toBeCloseTo(0, 6);
    expect(t.samples[0].z).toBeCloseTo(0, 6);
    const end = t.samples[t.samples.length - 1];
    expect(end.x).toBeCloseTo(60, 1);
    expect(end.z).toBeCloseTo(140, 1);
    expect(end.s).toBe(t.length);
  });

  it("clamps instead of wrapping past either end", () => {
    const past = pointAt(t, t.length + 30);
    const end = pointAt(t, t.length);
    expect(past.x).toBeCloseTo(end.x, 6);
    expect(past.z).toBeCloseTo(end.z, 6);
    const before = pointAt(t, -30);
    expect(before.z).toBeCloseTo(0, 6);
  });

  it("measures distance along it without a loop", () => {
    expect(arcDelta(t, 10, t.length - 10)).toBe(t.length - 20);
    const spot = locate(t, 60, 150);
    expect(spot?.s).toBe(t.length);
  });

  it("puts the grid just past the start gantry, facing down the track", () => {
    expect(t.grid[0].z).toBeGreaterThan(30);
    expect(t.grid[0].z).toBeLessThan(40);
    expect(Math.abs(t.grid[0].heading)).toBeLessThan(0.3);
  });

  it("walls both ends shut", () => {
    const caps = wallSegments(t).filter((w) => w.i === -1);
    expect(caps).toHaveLength(2);
    expect(caps[0].z).toBeLessThan(0);
    expect(caps[1].z).toBeGreaterThan(140);
  });

  it("has curbs only inside the track", () => {
    const runs = curbRuns(t);
    expect(runs.length).toBeGreaterThan(0);
    for (const [a, b] of runs) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(t.length);
    }
  });
});
