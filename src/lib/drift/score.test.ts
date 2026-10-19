import { describe, expect, it } from "vitest";
import { SPRINT, buildTrack, type TrackSpec } from "../league-city/race/track";
import { FrameRecorder, TICK_MS, frameAt, frameCount, type Frames } from "./frames";
import { DRIFT_SCORE, Scorer, scoreRun, type Clip, type Course } from "./score";

// A straight run north to south (+z), 1 km: left of travel is +x.
const STRAIGHT: TrackSpec = {
  ...SPRINT,
  id: "test-straight",
  closed: false,
  points: [[0, 0], [0, 250], [0, 500], [0, 750], [0, 1000]],
};
const track = buildTrack(STRAIGHT);
const course = (clips: Clip[] = []): Course => ({ track, clips });

interface Leg {
  secs: number;
  /** Speed at the start of the leg (km/h); `to` eases it to another by the end. */
  kmh: number;
  to?: number;
  /** Drift angle (degrees); positive yaws the nose left. */
  angle?: number;
  /** Sideways position (m, + left) at the end of the leg, eased from where it was. */
  lateral?: number;
}

/** Frames of a car driving the legs down the straight. */
function drive(legs: Leg[], startZ = 2): Frames {
  const out: Frames = [];
  let t = 0;
  let z = startZ;
  let x = 0;
  out.push(0, x, z, 0);
  for (const leg of legs) {
    const n = Math.round((leg.secs * 1000) / TICK_MS);
    const x0 = x;
    for (let i = 1; i <= n; i++) {
      const w = i / n;
      const kmh = leg.kmh + ((leg.to ?? leg.kmh) - leg.kmh) * w;
      z += (kmh / 3.6) * (TICK_MS / 1000);
      x = leg.lateral === undefined ? x0 : x0 + (leg.lateral - x0) * w;
      t += TICK_MS;
      out.push(t, Math.round(x * 100) / 100, Math.round(z * 100) / 100, Math.round((((leg.angle ?? 0) * Math.PI) / 180) * 1000) / 1000);
    }
  }
  return out;
}

const score = (legs: Leg[], clips: Clip[] = []) => scoreRun(course(clips), drive(legs));

describe("scoring a drift", () => {
  it("gives nothing for driving straight, too slow, or at too little angle", () => {
    expect(score([{ secs: 5, kmh: 80 }]).score).toBe(0);
    expect(score([{ secs: 5, kmh: 15, angle: 40 }, { secs: 3, kmh: 15 }]).score).toBe(0);
    expect(score([{ secs: 5, kmh: 80, angle: 8 }, { secs: 3, kmh: 80 }]).score).toBe(0);
  });

  it("gives nothing past the angle limit", () => {
    expect(score([{ secs: 4, kmh: 60, angle: 80 }, { secs: 3, kmh: 60 }]).score).toBe(0);
  });

  it("scores a drift once the chain ends, about (angle − 10 + km/h − 20) × 10 a second", () => {
    const r = score([{ secs: 1, kmh: 60 }, { secs: 3, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }]);
    const banks = r.events.filter((e) => e.kind === "bank");
    expect(banks).toHaveLength(1);
    expect(r.score).toBe(banks[0].points);
    // 3 s at (30 + 40) × 10 = 700/s, with the ramp and a multiplier that climbs from 1×.
    expect(r.score).toBeGreaterThan(700 * 2.5);
    expect(r.score).toBeLessThan(700 * 3 * 3);
  });

  it("ramps a drift's first second in", () => {
    const one = score([{ secs: 1, kmh: 60 }, { secs: 1, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }]).score;
    const two = score([{ secs: 1, kmh: 60 }, { secs: 2, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }]).score;
    expect(two - one).toBeGreaterThan(one * 1.5);
  });

  it("caps the multiplier at 5×", () => {
    const sc = new Scorer(course());
    const f = drive([{ secs: 1, kmh: 80 }, { secs: 15, kmh: 80, angle: 45 }]);
    let top = 0;
    for (let i = 0; i < frameCount(f); i++) top = Math.max(top, sc.step(frameAt(f, i)).mult);
    expect(top).toBe(DRIFT_SCORE.multMax);
  });

  it("grows the multiplier faster at a better angle and speed", () => {
    const multAfter = (angle: number, kmh: number) => {
      const sc = new Scorer(course());
      const f = drive([{ secs: 1, kmh }, { secs: 2, kmh, angle }]);
      for (let i = 0; i < frameCount(f); i++) sc.step(frameAt(f, i));
      return sc.state.mult;
    };
    expect(multAfter(45, 70)).toBeGreaterThan(multAfter(15, 30) + 0.5);
  });

  it("chains drifts linked within the window, banks them once", () => {
    const r = score([
      { secs: 1, kmh: 60 },
      { secs: 2, kmh: 60, angle: 40 },
      { secs: 0.3, kmh: 60 },
      { secs: 2, kmh: 60, angle: -40 },
      { secs: 3, kmh: 60 },
    ]);
    expect(r.events.filter((e) => e.kind === "bank")).toHaveLength(1);
  });

  it("loses the risk on a wall, and keeps what was banked", () => {
    const banked = score([{ secs: 1, kmh: 60 }, { secs: 2, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }]).score;
    const r = score([
      { secs: 1, kmh: 60 },
      { secs: 2, kmh: 60, angle: 40 },
      { secs: 3, kmh: 60 },
      { secs: 2, kmh: 60, angle: 40, lateral: 10.5 },
      { secs: 3, kmh: 60, lateral: 10.5 },
    ]);
    expect(r.events.some((e) => e.kind === "lost" && e.why === "wall")).toBe(true);
    expect(r.score).toBe(banked);
  });

  it("loses the risk on a spin", () => {
    const r = score([{ secs: 1, kmh: 60 }, { secs: 2, kmh: 60, angle: 40 }, { secs: 0.2, kmh: 40, angle: 150 }, { secs: 3, kmh: 40 }]);
    expect(r.events.some((e) => e.kind === "lost" && e.why === "spin")).toBe(true);
    expect(r.score).toBe(0);
  });

  it("halves the points while braking", () => {
    const steady = score([{ secs: 1, kmh: 70 }, { secs: 2, kmh: 70, angle: 40 }, { secs: 3, kmh: 70 }]).score;
    const braking = score([{ secs: 1, kmh: 70 }, { secs: 2, kmh: 70, to: 25, angle: 40 }, { secs: 3, kmh: 25 }]).score;
    // Slower too, so less anyway; braking takes more than the speed alone explains.
    const coasting = score([{ secs: 1, kmh: 70 }, { secs: 2, kmh: 70, to: 55, angle: 40 }, { secs: 3, kmh: 55 }]).score;
    expect(braking).toBeLessThan(coasting * 0.6);
    expect(coasting).toBeLessThan(steady);
  });

  it("drains the risk off the asphalt", () => {
    const clean = score([{ secs: 1, kmh: 60 }, { secs: 3, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }]).score;
    const grass = score([{ secs: 1, kmh: 60 }, { secs: 3, kmh: 60, angle: 40 }, { secs: 0.3, kmh: 60, lateral: 9.5 }, { secs: 3, kmh: 60, lateral: 9.5 }]).score;
    expect(grass).toBeLessThan(clean);
    expect(grass).toBeGreaterThan(0);
  });

  it("pays a clipping point passed in a drift, once", () => {
    const clip: Clip = { s: 60, len: 30, side: 1, kind: "inner", depth: 2.5 };
    // Drifting around a left-hander: the nose points left, into the corner.
    const legs: Leg[] = [{ secs: 1, kmh: 60 }, { secs: 0.5, kmh: 60, angle: 40, lateral: 5.5 }, { secs: 4, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }];
    const without = score(legs).score;
    const r = score(legs, [clip]);
    expect(r.events.filter((e) => e.kind === "clip")).toHaveLength(1);
    expect(r.score - without).toBeGreaterThanOrEqual(DRIFT_SCORE.clipPoints);
  });

  it("counts a clipping point's limiter as a wall", () => {
    const clip: Clip = { s: 60, len: 30, side: 1, kind: "inner", depth: 2.5 };
    const r = score([{ secs: 1, kmh: 60 }, { secs: 0.5, kmh: 60, angle: 40, lateral: 8 }, { secs: 4, kmh: 60, angle: 40 }, { secs: 3, kmh: 60 }], [clip]);
    expect(r.events.some((e) => e.kind === "lost" && e.why === "limiter")).toBe(true);
  });

  it("banks what's at risk at the finish", () => {
    const r = score([{ secs: 1, kmh: 100 }, { secs: 40, kmh: 100, angle: 40 }]);
    expect(r.finished).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it("gives the same score for the same frames, stepped live or all at once", () => {
    const f = drive([{ secs: 1, kmh: 60 }, { secs: 3, kmh: 65, angle: 35 }, { secs: 0.4, kmh: 60 }, { secs: 2, kmh: 55, angle: -50 }, { secs: 3, kmh: 60 }]);
    const a = scoreRun(course(), f).score;
    const b = scoreRun(course(), f).score;
    const sc = new Scorer(course());
    for (let i = 0; i < frameCount(f); i++) sc.step(frameAt(f, i));
    expect(a).toBe(b);
    expect(sc.state.score).toBe(a);
  });
});

describe("going the wrong way", () => {
  it("scores nothing for a drift driven backwards down the track", () => {
    // Start far down the straight and drive back toward the start, sideways.
    const f: number[] = [];
    let z = 600;
    let yaw = Math.PI;
    for (let t = 0; t <= 6000; t += TICK_MS) {
      const want = t > 1000 ? Math.PI - 0.7 : Math.PI;
      yaw += Math.max(-0.15, Math.min(0.15, want - yaw));
      f.push(t, 0, Math.round(z * 100) / 100, Math.round(yaw * 1000) / 1000);
      z -= 17 * (TICK_MS / 1000);
    }
    const sc = new Scorer(course());
    let hint = null;
    for (let i = 0; i < f.length / 4; i++) hint = sc.step(frameAt(f, i)).hint ?? hint;
    expect(sc.state.score + sc.state.risk).toBe(0);
    expect(hint).toBe("wrong");
  });
});

describe("FrameRecorder", () => {
  it("records exact ticks between uneven steps, interpolated", () => {
    const r = new FrameRecorder();
    r.begin(1000, 0, 0, 0);
    expect(r.push(1030, 3, 0, 0)).toHaveLength(0);
    const out = r.push(1110, 11, 0, 0.1);
    expect(out.map((f) => f.t)).toEqual([50, 100]);
    expect(out[0].x).toBeCloseTo(5, 6);
    expect(out[1].x).toBeCloseTo(10, 6);
    expect(r.all().length).toBe(12);
  });

  it("doesn't count a pause: no ticks while held, and the clock picks up where it stopped", () => {
    const r = new FrameRecorder();
    r.begin(0, 0, 0, 0);
    r.push(100, 2, 0, 0);
    r.hold(100);
    expect(r.push(5000, 2, 0, 0)).toHaveLength(0);
    expect(r.elapsed(5000)).toBe(100);
    r.release(5000);
    const out = r.push(5100, 4, 0, 0);
    expect(out.map((f) => f.t)).toEqual([150, 200]);
    expect(r.elapsed(5100)).toBe(200);
  });
});

describe("scoring each stretch once", () => {
  /** Frames at 17 m/s down the straight from z0 to z1 (either way), the nose `angle` rad off the travel. */
  function run(out: number[], from: { t: number; z: number }, z1: number, angle: number): { t: number; z: number } {
    let { t, z } = from;
    const dir = Math.sign(z1 - z);
    const travel = dir > 0 ? 0 : Math.PI;
    while ((z1 - z) * dir > 0) {
      t += TICK_MS;
      z += dir * 17 * (TICK_MS / 1000);
      out.push(t, 0, Math.round(z * 100) / 100, Math.round((travel + angle) * 1000) / 1000);
    }
    return { t, z };
  }

  it("gives nothing for driving back and drifting the same stretch again", () => {
    const once: number[] = [0, 0, 2, 0];
    run(once, run(once, run(once, { t: 0, z: 2 }, 40, 0), 140, 0.6), 200, 0);
    const first = scoreRun(course(), once).score;
    expect(first).toBeGreaterThan(0);

    // The same, then back up the straight and down it again in the same drift.
    const again = [...once];
    let at = { t: once[once.length - 4], z: once[once.length - 2] };
    at = run(again, at, 40, 0);
    at = run(again, at, 140, 0.6);
    run(again, at, 240, 0);
    const sc = new Scorer(course());
    let hint = null;
    for (let i = 0; i < frameCount(again); i++) hint = sc.step(frameAt(again, i)).hint ?? hint;
    expect(Math.round(sc.state.score + sc.state.risk)).toBe(first);
    expect(hint).toBe("covered");
  });

  it("gives nothing for circling on one spot once its first half turn is driven", () => {
    // Donuts 8 m across in the middle of the straight, sideways, for 20 s.
    const f: number[] = [0, 0, 200, 0];
    const r = 4;
    const w = 17 / r;
    for (let t = TICK_MS; t <= 20000; t += TICK_MS) {
      const a = (w * t) / 1000;
      const travel = a + Math.PI / 2;
      f.push(t, Math.round(r * Math.cos(a) * 100) / 100 - r, Math.round((200 + r * Math.sin(a)) * 100) / 100, Math.round((Math.atan2(Math.sin(travel), Math.cos(travel)) + 0.6) * 1000) / 1000);
    }
    const r1 = scoreRun(course(), f);
    expect(r1.score).toBeLessThan(500);
  });
});
