// ─── Drift score ────────────────────────────────────────────
// Scores a drift run from its frames (frames.ts), and nothing else: speed and
// the direction of travel come from how far the car moved between ticks, the
// drift angle is the nose against that direction, braking is how fast it
// slowed, and walls, asphalt and clipping points come from where the car is
// on the course. The HUD steps it live; the server runs it again over the
// posted frames to check the score.
//
// The rules, and where they come from:
// - A drift counts past 10° and 20 km/h on asphalt, and scores
//   ((angle − 10) + (km/h − 20)) × 10 × multiplier a second (the open source
//   Assetto Corsa drift app, built on NFSU and CarX).
// - Each drift's first second ramps in from nothing (AC): no farming flicks.
// - The multiplier grows from +1 every 2 s to +1 a second at a good angle and
//   speed, to 5× (Absolute Drift; the 5× cap from AC and NFSU).
// - Past 75° nothing scores (Absolute Drift); past 110° it's a spin.
// - Braking in a drift halves the points (AC).
// - Points are at risk until the drift chain ends: out of a drift the
//   multiplier decays, faster and faster, and the risk banks once it's back
//   to 1× (AC, NFSU). A wall, a spin or a clipping point's limiter loses the
//   risk (Forza, NFSU, Absolute Drift); off the asphalt or too slow drains it.
// - A clipping point passed in a drift is +500 × multiplier (CarX).
// - The finish banks whatever is at risk.

import { CHASSIS } from "../league-city/drive/tuning";
import { arcDelta, locate, locateNear, pointAt, type Track } from "../league-city/race/track";
import { TICK_MS, frameAt, frameCount, type Frame, type Frames } from "./frames";

export const DRIFT_SCORE = {
  minAngle: 10,
  maxAngle: 75,
  spinAngle: 110,
  minKmh: 20,
  /** Points a second per degree past minAngle and per km/h past minKmh, at 1×. */
  scale: 10,
  /** A drift's points ramp in over this long (s). */
  ramp: 1,
  multMax: 5,
  /** Multiplier growth (1/s): `base` for any drift, up to `best` at `fullAngle` and `fullKmh`. */
  multBase: 0.5,
  multBest: 1,
  fullAngle: 45,
  fullKmh: 70,
  /** Slowing faster than this in a drift is braking (m/s²), and what it leaves of the points. */
  brakeDecel: 4,
  brakeMul: 0.5,
  /** Out of a drift: the multiplier drops by decay × (time out) a second; the risk banks at 1× after chainMin, or at chainMax anyway (s). */
  decay: 4,
  chainMin: 0.5,
  chainMax: 2,
  /** Off the asphalt or under minKmh: the share of the risk lost a second. */
  drain: 1,
  clipPoints: 500,
  /** A corner of the car this close to a wall's face (m) is touching it. */
  wallSlack: 0.1,
  /** Farther than this between two ticks (m) is a jump: the car can't move that fast (34 m/s). */
  jump: 1.7,
} as const;

/** Where a respawn at checkpoint k puts the car: on the centerline, facing down the track. */
export function respawnPose(track: Track, k: number): { x: number; z: number; heading: number } {
  const p = pointAt(track, track.checkpoints[k]);
  return { x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz) };
}

/**
 * A clipping point: a stretch of the course [s, s + len] on one side (1 left
 * of travel, -1 right) where the car should pass close to the edge in a
 * drift. Inner: the nose along the asphalt's inside edge at the apex, with a
 * limiter just past the curb. Outer: the tail along the wall (the wall is the
 * limiter).
 */
export interface Clip {
  s: number;
  len: number;
  side: 1 | -1;
  kind: "inner" | "outer";
  /** How far in from the edge the zone reaches (m). */
  depth: number;
}

export interface Course {
  track: Track;
  clips: readonly Clip[];
}

export type DriftEvent =
  | { t: number; kind: "bank"; points: number }
  | { t: number; kind: "lost"; points: number; why: "wall" | "spin" | "limiter" | "respawn" }
  | { t: number; kind: "clip"; points: number; clip: number };

export type AngleBand = "dead" | "ideal" | "over";

export interface DriftState {
  /** Time into the run (ms). */
  t: number;
  /** Banked score. */
  score: number;
  /** Points at risk in the chain under way. */
  risk: number;
  mult: number;
  /** Seconds out of a drift in the chain under way (0 while drifting). */
  gap: number;
  /** Drift angle (degrees) and its band, speed (km/h). */
  angle: number;
  band: AngleBand;
  kmh: number;
  /** Scoring this tick. */
  drifting: boolean;
  braking: boolean;
  /** Distance along the course from the start line (m); a loop's first meters can be negative (the grid). */
  progress: number;
  /** Score (banked plus risk) at each of the track's split checkpoints passed so far. */
  splits: number[];
  finished: boolean;
  /** What happened this tick. */
  events: DriftEvent[];
}

const DT = TICK_MS / 1000;
const DEG = 180 / Math.PI;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const [HX, , HZ] = CHASSIS.half;
const CORNERS: [number, number][] = [[HX, HZ], [-HX, HZ], [HX, -HZ], [-HX, -HZ]];

export class Scorer {
  private readonly track: Track;
  private readonly clips: readonly Clip[];
  private readonly asphalt: number;
  private readonly wallFace: number;
  private readonly limiter: number;
  private readonly recent: Frame[] = [];
  private readonly speeds: number[] = [];
  private s = 0;
  private segment = 0;
  private nextCheckpoint = 1;
  private readonly clipped = new Set<number>();
  private started = false;
  /** The car's center went past a wall (impossible when driven): the run can't be real. */
  outside = false;
  /** Ticks where the car was put back on a checkpoint it had passed (Enter). */
  readonly respawns: number[] = [];
  /** The car jumped somewhere a respawn can't put it: the run can't be real. */
  badJump = false;
  private ticks = 0;
  state: DriftState;

  constructor(course: Course) {
    this.track = course.track;
    this.clips = course.clips;
    const spec = course.track.spec;
    this.asphalt = spec.width / 2 + spec.curb;
    this.wallFace = spec.width / 2 + spec.runoff;
    this.limiter = spec.width / 2 + spec.curb + 0.3;
    this.state = {
      t: 0, score: 0, risk: 0, mult: 1, gap: 0, angle: 0, band: "dead", kmh: 0, drifting: false, braking: false,
      progress: 0, splits: [], finished: false, events: [],
    };
  }

  /** One tick. Frames must come every TICK_MS from t = 0. */
  step(f: Frame): DriftState {
    const st = this.state;
    st.events = [];
    if (st.finished) return st;
    st.t = f.t;
    const tick = this.ticks++;
    const prev = this.recent[this.recent.length - 1];
    if (prev && Math.hypot(f.x - prev.x, f.z - prev.z) > DRIFT_SCORE.jump) this.respawn(f, tick);
    this.recent.push(f);
    if (this.recent.length > 3) this.recent.shift();

    // Where on the course: a window around the last spot keeps it on the right stretch.
    const t = this.track;
    const spot = this.started ? locateNear(t, f.x, f.z, this.s, 20, 40) : locate(t, f.x, f.z, 60) ?? locateNear(t, f.x, f.z, 0, 0, 40);
    st.progress = this.started ? st.progress + arcDelta(t, this.s, spot.s) : t.closed ? arcDelta(t, 0, spot.s) : spot.s;
    this.s = spot.s;
    this.started = true;
    const p = t.samples[spot.i];
    const nx = p.tz;
    const nz = -p.tx; // left of travel
    const lateral = spot.lateral;
    if (Math.abs(lateral) > this.wallFace + 0.5) this.outside = true;

    // Motion over the last two ticks.
    const a = this.recent[0];
    const span = (f.t - a.t) / 1000;
    const vx = span > 0 ? (f.x - a.x) / span : 0;
    const vz = span > 0 ? (f.z - a.z) / span : 0;
    const speed = Math.hypot(vx, vz);
    this.speeds.push(speed);
    if (this.speeds.length > 5) this.speeds.shift();
    const decel = this.speeds.length === 5 ? (this.speeds[0] - speed) / (4 * DT) : 0;
    st.kmh = speed * 3.6;
    st.angle = speed > 1 ? Math.abs(wrap(f.yaw - Math.atan2(vx, vz))) * DEG : 0;
    st.band = st.angle < DRIFT_SCORE.minAngle ? "dead" : st.angle > DRIFT_SCORE.maxAngle ? "over" : "ideal";

    // The car's corners, sideways from the centerline (+x of the car is its left).
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    let most = -Infinity;
    let least = Infinity;
    for (const [cx, cz] of CORNERS) {
      const wx = cx * fz + cz * fx;
      const wz = -cx * fx + cz * fz;
      const l = lateral + wx * nx + wz * nz;
      most = Math.max(most, l);
      least = Math.min(least, l);
    }
    const wall = most >= this.wallFace - DRIFT_SCORE.wallSlack || least <= -(this.wallFace - DRIFT_SCORE.wallSlack);
    const spin = st.angle > DRIFT_SCORE.spinAngle && speed > 3;
    let limiter = false;
    for (const c of this.clips) {
      if (c.kind !== "inner" || !this.within(c)) continue;
      if ((c.side > 0 ? most : -least) > this.limiter) limiter = true;
    }

    // Split checkpoints and the finish.
    this.passCheckpoints();
    const finish = t.closed ? st.progress >= t.length : st.progress >= t.length - 1;

    const onAsphalt = Math.abs(lateral) <= this.asphalt;
    if (wall || spin || limiter) {
      st.drifting = false;
      st.braking = false;
      if (st.risk >= 0.5) st.events.push({ t: f.t, kind: "lost", points: Math.round(st.risk), why: wall ? "wall" : spin ? "spin" : "limiter" });
      this.reset();
    } else {
      st.drifting = st.band === "ideal" && st.kmh > DRIFT_SCORE.minKmh && onAsphalt;
      st.braking = st.drifting && decel > DRIFT_SCORE.brakeDecel;
      if (st.drifting) {
        this.segment += DT;
        st.gap = 0;
        const ramp = clamp01(this.segment / DRIFT_SCORE.ramp);
        const rate = (st.angle - DRIFT_SCORE.minAngle + st.kmh - DRIFT_SCORE.minKmh) * DRIFT_SCORE.scale;
        st.risk += rate * st.mult * ramp * (st.braking ? DRIFT_SCORE.brakeMul : 1) * DT;
        const q = clamp01((st.angle - DRIFT_SCORE.minAngle) / (DRIFT_SCORE.fullAngle - DRIFT_SCORE.minAngle)) *
          clamp01((st.kmh - DRIFT_SCORE.minKmh) / (DRIFT_SCORE.fullKmh - DRIFT_SCORE.minKmh));
        st.mult = Math.min(DRIFT_SCORE.multMax, st.mult + (DRIFT_SCORE.multBase + (DRIFT_SCORE.multBest - DRIFT_SCORE.multBase) * q) * DT);
        this.clipAt(f, lateral, nx, nz);
      } else {
        this.segment = 0;
        if (st.risk > 0 || st.mult > 1) {
          st.gap += DT;
          if (st.risk > 0 && (!onAsphalt || st.kmh <= DRIFT_SCORE.minKmh)) {
            st.risk -= st.risk * DRIFT_SCORE.drain * DT;
            st.mult = Math.max(1, st.mult - DT);
          }
          st.mult = Math.max(1, st.mult - DRIFT_SCORE.decay * st.gap * DT);
          if ((st.gap >= DRIFT_SCORE.chainMin && st.mult <= 1) || st.gap >= DRIFT_SCORE.chainMax) this.bank(f.t);
        }
      }
    }

    if (finish) {
      this.bank(f.t);
      st.finished = true;
    }
    return st;
  }

  /**
   * A jump: legal only onto a checkpoint already passed, at its respawn pose.
   * The chain at risk is lost and the car goes on from there.
   */
  private respawn(f: Frame, tick: number): void {
    const st = this.state;
    for (let k = this.nextCheckpoint - 1; k >= 0; k--) {
      const p = respawnPose(this.track, k);
      if (Math.hypot(f.x - p.x, f.z - p.z) > 1 || Math.abs(wrap(f.yaw - p.heading)) > 0.2) continue;
      this.respawns.push(tick);
      if (st.risk >= 0.5) st.events.push({ t: f.t, kind: "lost", points: Math.round(st.risk), why: "respawn" });
      this.reset();
      this.recent.length = 0;
      this.speeds.length = 0;
      this.s = this.track.checkpoints[k];
      st.progress = this.track.checkpoints[k];
      return;
    }
    this.badJump = true;
  }

  private within(c: Clip): boolean {
    return this.s >= c.s && this.s <= c.s + c.len;
  }

  /** A clipping point passed: the nose (inner) or the tail (outer) inside its zone. */
  private clipAt(f: Frame, lateral: number, nx: number, nz: number): void {
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    this.clips.forEach((c, i) => {
      if (this.clipped.has(i) || !this.within(c)) return;
      const along = c.kind === "inner" ? HZ : -HZ;
      const l = (lateral + along * (fx * nx + fz * nz)) * c.side;
      const edge = c.kind === "inner" ? this.track.spec.width / 2 : this.wallFace;
      if (l >= edge - c.depth && l <= edge + 0.5) {
        this.clipped.add(i);
        const points = DRIFT_SCORE.clipPoints * this.state.mult;
        this.state.risk += points;
        this.state.events.push({ t: f.t, kind: "clip", points: Math.round(points), clip: i });
      }
    });
  }

  private passCheckpoints(): void {
    const st = this.state;
    const cps = this.track.checkpoints;
    while (this.nextCheckpoint < cps.length && st.progress >= cps[this.nextCheckpoint]) {
      if (this.track.spec.splits.includes(this.nextCheckpoint)) st.splits.push(Math.round(st.score + st.risk));
      this.nextCheckpoint++;
    }
  }

  private bank(t: number): void {
    const st = this.state;
    if (st.risk > 0) {
      const points = Math.round(st.risk);
      st.score += points;
      st.events.push({ t, kind: "bank", points });
    }
    this.reset();
  }

  private reset(): void {
    const st = this.state;
    st.risk = 0;
    st.mult = 1;
    st.gap = 0;
    this.segment = 0;
  }

  /** The checkpoint the car heads for next (index into track.checkpoints). */
  get checkpoint(): number {
    return this.nextCheckpoint;
  }
}

export interface RunScore {
  score: number;
  finished: boolean;
  splits: number[];
  events: DriftEvent[];
  /** Checkpoints passed, in order. */
  checkpoints: number;
  /** Time of the last frame scored (ms): the finish, when finished. */
  ms: number;
  /** The car's center was past a wall at some point. */
  outside: boolean;
  /** Frame indices where the car respawned on a checkpoint. */
  respawns: number[];
  /** The car jumped somewhere a respawn can't put it. */
  badJump: boolean;
}

/** Score a whole run. */
export function scoreRun(course: Course, frames: Frames): RunScore {
  const sc = new Scorer(course);
  const events: DriftEvent[] = [];
  const n = frameCount(frames);
  for (let i = 0; i < n; i++) {
    const st = sc.step(frameAt(frames, i));
    events.push(...st.events);
    if (st.finished) break;
  }
  return { score: sc.state.score, finished: sc.state.finished, splits: [...sc.state.splits], events, checkpoints: sc.checkpoint - 1, ms: sc.state.t, outside: sc.outside, respawns: [...sc.respawns], badJump: sc.badJump };
}
