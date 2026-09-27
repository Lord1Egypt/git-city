import { describe, expect, it } from "vitest";
import { SPRINT, buildTrack, type TrackSpec } from "../league-city/race/track";
import { TICK_MS, type Frames } from "./frames";
import { respawnPose, scoreRun, type Course } from "./score";
import { validateRun } from "./validate";

// A 300 m straight run: drive it at 90 km/h with two drifts.
const RUN: TrackSpec = { ...SPRINT, id: "test-validate", closed: false, points: [[0, 0], [0, 100], [0, 200], [0, 300]] };
const course: Course = { track: buildTrack(RUN), clips: [] };
const slot = course.track.grid[0];

function clean(): Frames {
  const out: Frames = [];
  let z = slot.z;
  let yaw = 0;
  for (let t = 0; t <= 16_000; t += TICK_MS) {
    const drifting = (t > 2000 && t < 5000) || (t > 6000 && t < 9000);
    const want = drifting ? (t < 5500 ? 0.7 : -0.7) : 0;
    yaw += Math.max(-0.15, Math.min(0.15, want - yaw)); // 3 rad/s, like the car
    out.push(t, Math.round(slot.x * 100) / 100, Math.round(z * 100) / 100, Math.round(yaw * 1000) / 1000);
    z += 25 * (TICK_MS / 1000);
  }
  return out;
}

describe("validateRun", () => {
  const frames = clean();
  const real = scoreRun(course, frames);

  it("accepts a clean run and returns the server's score", () => {
    expect(real.finished).toBe(true);
    expect(real.score).toBeGreaterThan(0);
    const r = validateRun(course, frames, real.score, 5000);
    expect(r).toMatchObject({ ok: true, score: real.score });
  });

  it("accepts a score a few points off (another engine's float rounding)", () => {
    expect(validateRun(course, frames, real.score + 10, 5000).ok).toBe(true);
  });

  it("rejects an edited score", () => {
    expect(validateRun(course, frames, real.score * 2, 5000)).toEqual({ ok: false, reason: "score" });
  });

  it("rejects a teleport", () => {
    const f = [...frames];
    f[40 * 4 + 2] += 30;
    expect(validateRun(course, f, real.score, 5000)).toEqual({ ok: false, reason: "speed" });
  });

  it("rejects driving faster than the car can", () => {
    const f: Frames = [];
    for (let t = 0, z = slot.z; t <= 8000; t += TICK_MS, z += 60 * (TICK_MS / 1000)) f.push(t, slot.x, z, 0);
    expect(validateRun(course, f, 0, 0)).toEqual({ ok: false, reason: "speed" });
  });

  it("rejects turning faster than the car can", () => {
    const f = [...frames];
    f[30 * 4 + 3] = 3;
    expect(validateRun(course, f, real.score, 5000)).toEqual({ ok: false, reason: "turn" });
  });

  it("rejects missing or uneven ticks", () => {
    const f = [...frames];
    f[10 * 4] += 7;
    expect(validateRun(course, f, real.score, 5000)).toEqual({ ok: false, reason: "ticks" });
  });

  it("rejects a run that doesn't start on the grid", () => {
    const f = frames.map((v, i) => (i % 4 === 2 ? v + 20 : v));
    expect(validateRun(course, f, real.score, 5000)).toMatchObject({ ok: false });
  });

  it("rejects a run that stops before the finish", () => {
    const f = frames.slice(0, 200 * 4);
    expect(validateRun(course, f, 0, 0)).toEqual({ ok: false, reason: "unfinished" });
  });

  it("rejects a run shorter than the spot allows", () => {
    expect(validateRun(course, frames, real.score, 60_000)).toEqual({ ok: false, reason: "short" });
  });

  it("rejects junk", () => {
    expect(validateRun(course, "frames", 1, 0)).toEqual({ ok: false, reason: "shape" });
    expect(validateRun(course, [1, 2, 3], 1, 0)).toEqual({ ok: false, reason: "shape" });
    expect(validateRun(course, frames, 1.5, 0)).toEqual({ ok: false, reason: "shape" });
    expect(validateRun(course, frames.map((v, i) => (i === 9 ? Number.NaN : v)), 1, 0)).toEqual({ ok: false, reason: "shape" });
  });

  it("accepts a respawn onto a checkpoint already passed, and loses the drift at risk", () => {
    // Drifting at 5.5 s, the car is put back on checkpoint 2 (80 m) and drives on from there.
    const pose = respawnPose(course.track, 2);
    const f: Frames = [];
    let z = slot.z;
    let x = slot.x;
    let yaw = 0;
    let jumped = false;
    for (let t = 0; t <= 20_000; t += TICK_MS) {
      if (!jumped && t === 5500) {
        jumped = true;
        x = pose.x;
        z = pose.z;
        yaw = pose.heading;
      }
      const want = t > 2000 && t < 5500 ? 0.7 : 0;
      yaw += Math.max(-0.15, Math.min(0.15, want - yaw));
      f.push(t, Math.round(x * 100) / 100, Math.round(z * 100) / 100, Math.round(yaw * 1000) / 1000);
      z += 25 * (TICK_MS / 1000);
    }
    const r = scoreRun(course, f);
    expect(r.respawns).toHaveLength(1);
    expect(r.events.some((e) => e.kind === "lost" && e.why === "respawn")).toBe(true);
    expect(validateRun(course, f, r.score, 5000)).toMatchObject({ ok: true });
  });

  it("rejects a jump onto a checkpoint not reached yet", () => {
    const pose = respawnPose(course.track, 6);
    const f = [...frames];
    f[20 * 4 + 1] = pose.x;
    f[20 * 4 + 2] = pose.z;
    f[20 * 4 + 3] = pose.heading;
    expect(validateRun(course, f, real.score, 5000)).toEqual({ ok: false, reason: "speed" });
  });
});
