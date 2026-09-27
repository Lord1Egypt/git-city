import { describe, expect, it } from "vitest";
import { offsetAt } from "../../league-city/race/layout";
import { finishOf } from "../../league-city/race/track";
import { TICK_MS, type Frames } from "../frames";
import { validateRun } from "../validate";
import { SPOTS, courseOf, getLiveSpot } from "./index";
import { medalFor, medalScores, type LiveSpot } from "./types";

const live = SPOTS.filter((s): s is LiveSpot => s.status === "live");

/** Frames of a car driving the line of pole position (a quarter of the width left of center) at `speed` m/s from the grid to past the finish. */
function lap(spot: LiveSpot, speed = 18): Frames {
  const { track } = courseOf(spot);
  const out: Frames = [];
  const slot = track.grid[0];
  const start = track.closed ? track.length - track.spec.gridFirst : 36;
  const end = track.closed ? start + track.length + track.spec.gridFirst + 5 : track.length + 5;
  let t = 0;
  out.push(0, Math.round(slot.x * 100) / 100, Math.round(slot.z * 100) / 100, Math.round(slot.heading * 1000) / 1000);
  for (let s = start; s < end; s += speed * (TICK_MS / 1000)) {
    t += TICK_MS;
    const p = offsetAt(track, s, track.spec.width / 4);
    out.push(t, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round(Math.atan2(p.tx, p.tz) * 1000) / 1000);
  }
  return out;
}

describe.each(live.map((s) => [s.id, s] as const))("%s", (_id, spot) => {
  const { track } = courseOf(spot);

  it("is a run of 30 to 60 seconds at drift speed, start to finish", () => {
    const secs = finishOf(track) / 17;
    expect(secs).toBeGreaterThan(30);
    expect(secs).toBeLessThan(60);
  });

  it("keeps its straights short: nowhere runs straight for more than 70 m", () => {
    let run = 0;
    let longest = 0;
    for (const p of track.samples) {
      if (p.s > finishOf(track)) break;
      run = Math.abs(p.k) < 1 / 200 ? run + 2 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThan(70);
  });

  it("has its split checkpoints on the course", () => {
    for (const k of track.spec.splits) expect(k).toBeLessThan(track.checkpoints.length);
  });

  it("never runs over itself: stretches far apart along the track stay a wall's width apart", () => {
    const clear = 2 * (track.spec.width / 2 + track.spec.runoff);
    const n = track.samples.length;
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 2; j < n; j += 2) {
        const along = track.closed ? Math.min(j - i, n - (j - i)) * 2 : (j - i) * 2;
        if (along < 80) continue;
        const a = track.samples[i];
        const b = track.samples[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(clear);
      }
    }
  });

  it("puts its clipping points on the track", () => {
    for (const c of spot.clips) {
      expect(c.s).toBeGreaterThan(0);
      expect(c.s + c.len).toBeLessThan(track.length);
    }
  });

  it("takes a clean lap as a valid run (no drift, no points)", () => {
    const r = validateRun(courseOf(spot), lap(spot), 0, spot.minMs);
    expect(r).toMatchObject({ ok: true, score: 0 });
  });

  it("hands out medals from the author's score down", () => {
    const [[, author], [, gold], [, silver], [, bronze]] = medalScores(spot);
    expect(author > gold && gold > silver && silver > bronze).toBe(true);
    expect(medalFor(spot, author)).toBe("author");
    expect(medalFor(spot, gold)).toBe("gold");
    expect(medalFor(spot, bronze - 1)).toBeNull();
  });
});

describe("the spot list", () => {
  it("opens with the two live spots, then four to come", () => {
    expect(SPOTS.map((s) => [s.id, s.status])).toEqual([
      ["harbor", "live"],
      ["touge", "live"],
      ["cold-storage", "soon"],
      ["salt-flat", "soon"],
      ["permafrost", "soon"],
      ["spiral", "soon"],
    ]);
    expect(getLiveSpot("spiral")).toBeNull();
    expect(getLiveSpot("nope")).toBeNull();
  });
});
