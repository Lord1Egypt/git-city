// ─── Drift run validation ───────────────────────────────────
// What the server checks before a run goes on the board: the frames are a
// well-formed recording on exact ticks, the car never moved or turned faster
// than it can, it started on the grid and passed every checkpoint to the
// finish, and scoring the frames again gives the score the client claims.
// This stops an edited score, a teleport and impossible speed; it can't tell
// a well-made bot from a driver (the race's lap receipts can't either).

import { TICK_MS, MAX_FRAMES, type Frames } from "./frames";
import { scoreRun, type Course } from "./score";

export const VALIDATE = {
  /** Fastest the car moves (m/s): the drift spots' top speed plus room. */
  maxSpeed: 34,
  /** Fastest it turns (rad/s): a spin-out plus room. */
  maxYawRate: 9,
  /** How far from the grid slot the first frame may be (m). */
  gridSlack: 4,
  /** Scores from another JS engine may differ by float rounding: this much is the same score. */
  tolerance: (score: number) => Math.max(20, Math.round(score * 0.002)),
} as const;

export type RunCheck =
  | { ok: true; score: number; splits: number[]; ms: number }
  | { ok: false; reason: "shape" | "ticks" | "grid" | "speed" | "turn" | "unfinished" | "outside" | "checkpoints" | "short" | "score" };

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function validateRun(course: Course, frames: unknown, claimed: unknown, minMs: number): RunCheck {
  if (!Array.isArray(frames) || frames.length < 80 || frames.length % 4 !== 0 || frames.length > MAX_FRAMES * 4) return { ok: false, reason: "shape" };
  if (typeof claimed !== "number" || !Number.isInteger(claimed) || claimed < 0) return { ok: false, reason: "shape" };
  for (const v of frames) if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e7) return { ok: false, reason: "shape" };
  const f = frames as Frames;
  const n = f.length / 4;

  for (let i = 0; i < n; i++) if (f[i * 4] !== i * TICK_MS) return { ok: false, reason: "ticks" };

  const slot = course.track.grid[0];
  if (Math.hypot(f[1] - slot.x, f[2] - slot.z) > VALIDATE.gridSlack) return { ok: false, reason: "grid" };

  const dt = TICK_MS / 1000;
  for (let i = 1; i < n; i++) {
    const a = (i - 1) * 4;
    const b = i * 4;
    if (Math.hypot(f[b + 1] - f[a + 1], f[b + 2] - f[a + 2]) > VALIDATE.maxSpeed * dt) return { ok: false, reason: "speed" };
    if (Math.abs(wrap(f[b + 3] - f[a + 3])) > VALIDATE.maxYawRate * dt) return { ok: false, reason: "turn" };
  }

  const r = scoreRun(course, f);
  if (!r.finished) return { ok: false, reason: "unfinished" };
  if (r.outside) return { ok: false, reason: "outside" };
  if (r.checkpoints < course.track.checkpoints.length - 1) return { ok: false, reason: "checkpoints" };
  const ms = r.ms;
  if (ms < minMs) return { ok: false, reason: "short" };
  if (Math.abs(r.score - claimed) > VALIDATE.tolerance(r.score)) return { ok: false, reason: "score" };
  return { ok: true, score: r.score, splits: r.splits, ms };
}
