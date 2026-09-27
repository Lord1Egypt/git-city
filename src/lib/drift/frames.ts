// ─── Drift run frames ───────────────────────────────────────
// A drift run is recorded as the car's pose on exact 50 ms ticks from GO:
// flat [t, x, z, yaw, …] (ms, meters, radians), rounded to cm and mrad. The
// same frames feed the live score, the ghost and the server's re-score, so
// the number on screen is the number posted, at any frame rate. Physics steps
// don't land on ticks, so each tick is interpolated between the two steps
// around it.

/** Time between frames (ms). */
export const TICK_MS = 50;
/** Longest run kept (ms): four minutes. */
export const MAX_RUN_MS = 240_000;
export const MAX_FRAMES = MAX_RUN_MS / TICK_MS + 1;

/** Flat [t, x, z, yaw, …]. */
export type Frames = number[];

export interface Frame {
  t: number;
  x: number;
  z: number;
  yaw: number;
}

const cm = (v: number) => Math.round(v * 100) / 100;
const mrad = (v: number) => Math.round(v * 1000) / 1000;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The i-th frame of a flat list. */
export function frameAt(frames: Frames, i: number): Frame {
  const k = i * 4;
  return { t: frames[k], x: frames[k + 1], z: frames[k + 2], yaw: frames[k + 3] };
}

export function frameCount(frames: Frames): number {
  return Math.floor(frames.length / 4);
}

export class FrameRecorder {
  private frames: Frames = [];
  private start: number | null = null;
  private prev: Frame | null = null;
  private nextTick = 0;

  /** The run starts at `at` (performance.now), with the car at this pose. Returns the first frame. */
  begin(at: number, x: number, z: number, yaw: number): Frame {
    this.start = at;
    this.frames = [];
    const f = { t: 0, x: cm(x), z: cm(z), yaw: mrad(yaw) };
    this.frames.push(f.t, f.x, f.z, f.yaw);
    this.prev = { t: 0, x, z, yaw };
    this.nextTick = TICK_MS;
    return f;
  }

  /** Stop recording (a restart, the finish). */
  stop(): void {
    this.start = null;
  }

  get running(): boolean {
    return this.start !== null;
  }

  /** The car's pose now; returns the frames of every tick passed since the last call. */
  push(now: number, x: number, z: number, yaw: number): Frame[] {
    if (this.start === null || !this.prev) return [];
    const t = now - this.start;
    const out: Frame[] = [];
    const p = this.prev;
    while (this.nextTick <= t && this.nextTick < MAX_RUN_MS) {
      const w = t > p.t ? (this.nextTick - p.t) / (t - p.t) : 1;
      const f = {
        t: this.nextTick,
        x: cm(p.x + (x - p.x) * w),
        z: cm(p.z + (z - p.z) * w),
        yaw: mrad(wrap(p.yaw + wrap(yaw - p.yaw) * w)),
      };
      this.frames.push(f.t, f.x, f.z, f.yaw);
      out.push(f);
      this.nextTick += TICK_MS;
    }
    this.prev = { t, x, z, yaw };
    return out;
  }

  /**
   * The car was put somewhere else (a respawn): the ticks up to now keep the
   * old pose, and interpolation goes on from the new one, so no tick lands
   * halfway between.
   */
  snap(now: number, x: number, z: number, yaw: number): Frame[] {
    if (this.start === null || !this.prev) return [];
    const out = this.push(now, this.prev.x, this.prev.z, this.prev.yaw);
    this.prev = { t: now - this.start, x, z, yaw };
    return out;
  }

  /** Everything recorded so far. */
  all(): Frames {
    return [...this.frames];
  }
}
