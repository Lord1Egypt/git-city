// ─── Smash ──────────────────────────────────────────────────
// Driving through the rival town's buildings. Each building is a grid of up
// to 4×4 columns (cut on its window lines), each column a stack of floors.
// A car passing through a column takes its bottom floor and the rest drops a
// row; blasts take several. The building is its own health bar: a small one
// falls in a few passes, a tall one in many. Knocked-out floors grow back on
// their own, one row every `regenMs`.
//
// Everything is in city units. The store is shared by the drive world (which
// hits it) and the building renderer (which draws it), so both ask `frame`
// for the animated heights and the first call per timestamp advances them.

export const SMASH = {
  maxCols: 4,
  /** A car hit needs at least this speed (m/s). */
  minSpeed: 5,
  /** One car takes one floor from a column at most this often (ms). */
  cooldownMs: 220,
  /** The car's footprint for hits (units). */
  carRadius: 3.2,
  /** Floors a pass takes, and with boost. */
  rows: 1,
  boostRows: 2,
  /** A floor grows back after this long (ms). */
  regenMs: 3_600_000,
  /** A column falls into the gap its lost floors leave (floors/s²), bounces a little, and grows back (floors/s). */
  gravity: 30,
  bounce: 0.22,
  grow: 3,
} as const;

/** Column slots per building (4 × 4). */
export const SMASH_SLOTS = SMASH.maxCols * SMASH.maxCols;

export interface SmashSource {
  loginLower: string;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
}

export interface SmashTarget {
  login: string;
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  floorH: number;
  /** Column edges as fractions of width (nx + 1) and depth (nz + 1), on window lines. */
  xs: number[];
  zs: number[];
}

export interface SmashHit {
  /** Where the floor came off (units). */
  x: number;
  y: number;
  z: number;
  target: number;
  /** The building has no floors left. */
  down: boolean;
}

/** Column edges: n columns across `windows` windows, cut on window lines. */
export function columnEdges(windows: number, max: number = SMASH.maxCols): number[] {
  const w = Math.max(1, Math.round(windows));
  const n = Math.max(1, Math.min(max, w));
  return Array.from({ length: n + 1 }, (_, i) => Math.round((i * w) / n) / w);
}

export function toTarget(b: SmashSource): SmashTarget {
  const floors = Math.max(1, Math.round(b.floors));
  return {
    login: b.loginLower,
    x: b.position[0],
    z: b.position[2],
    w: b.width,
    d: b.depth,
    floors,
    floorH: b.height / floors,
    xs: columnEdges(b.windowsPerFloor),
    zs: columnEdges(b.sideWindowsPerFloor),
  };
}

/** Circle (cx, cz, r) against rectangle [x0, x1] × [z0, z1]. */
function touches(cx: number, cz: number, r: number, x0: number, x1: number, z0: number, z1: number): boolean {
  const dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0;
  const dz = cz < z0 ? z0 - cz : cz > z1 ? cz - z1 : 0;
  return dx * dx + dz * dz <= r * r;
}

export class SmashStore {
  readonly targets: SmashTarget[];
  readonly index = new Map<string, number>();
  /** Floors left per column, slot = target * SMASH_SLOTS + column. */
  readonly rows: Uint8Array;
  /** Drawn floors per column (grows toward `rows` when floors come back). */
  readonly shown: Float32Array;
  /** How far (floors) each column still floats above the ground, falling into the gap. */
  readonly drop: Float32Array;
  private vel: Float32Array;
  /** Bumps whenever a building starts or stops being damaged. */
  version = 0;
  private since: Float64Array;
  private damaged: Uint8Array;
  private moving = new Set<number>();
  private lastTake = new Map<number, number>();
  private lastFrame = -1;
  private regenMs: number;

  constructor(buildings: readonly SmashSource[], regenMs: number = SMASH.regenMs) {
    this.targets = buildings.map(toTarget);
    this.targets.forEach((t, i) => this.index.set(t.login, i));
    this.rows = new Uint8Array(this.targets.length * SMASH_SLOTS);
    this.shown = new Float32Array(this.targets.length * SMASH_SLOTS);
    this.drop = new Float32Array(this.targets.length * SMASH_SLOTS);
    this.vel = new Float32Array(this.targets.length * SMASH_SLOTS);
    this.since = new Float64Array(this.targets.length);
    this.damaged = new Uint8Array(this.targets.length);
    this.targets.forEach((t, i) => {
      for (let c = 0; c < cols(t); c++) {
        this.rows[i * SMASH_SLOTS + c] = t.floors;
        this.shown[i * SMASH_SLOTS + c] = t.floors;
      }
    });
    this.regenMs = regenMs;
  }

  isDamaged(target: number): boolean {
    return this.damaged[target] === 1;
  }

  /** Damaged or still animating: the renderer draws these as columns. */
  isBroken(target: number): boolean {
    return this.damaged[target] === 1 || this.moving.has(target);
  }

  /** Grow floors back, drop columns into their gaps. Returns the targets that moved. Once per `now`. */
  frame(now: number, dt: number): ReadonlySet<number> {
    if (now === this.lastFrame) return this.moving;
    this.lastFrame = now;
    for (let i = 0; i < this.targets.length; i++) if (this.damaged[i]) this.regen(i, now);
    for (const i of this.moving) {
      const t = this.targets[i];
      let still = true;
      for (let c = 0; c < cols(t); c++) {
        const s = i * SMASH_SLOTS + c;
        const goal = this.rows[s];
        let v = this.shown[s];
        if (v > goal) v = goal;
        else if (v < goal) v = Math.min(goal, v + SMASH.grow * dt);
        if (v !== goal) still = false;
        this.shown[s] = v;
        if (this.drop[s] > 0 || this.vel[s] !== 0) {
          this.vel[s] += SMASH.gravity * dt;
          this.drop[s] -= this.vel[s] * dt;
          if (this.drop[s] <= 0) {
            this.drop[s] = 0;
            this.vel[s] = this.vel[s] > 4 ? -this.vel[s] * SMASH.bounce : 0;
          }
          still = false;
        }
      }
      if (still) {
        this.moving.delete(i);
        if (!this.damaged[i]) this.version++;
      }
    }
    return this.moving;
  }

  /**
   * Takes `n` floors from every standing column the circle touches. With a
   * cooldown, a column hit less than that long ago by the same source is
   * skipped (a car inside a column takes one floor per pass, not per frame).
   */
  hitCircle(cx: number, cz: number, r: number, n: number, now: number, cooldownMs = 0): SmashHit[] {
    const hits: SmashHit[] = [];
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      const bx0 = t.x - t.w / 2;
      const bz0 = t.z - t.d / 2;
      if (!touches(cx, cz, r, bx0, bx0 + t.w, bz0, bz0 + t.d)) continue;
      if (this.damaged[i]) this.regen(i, now);
      const nx = t.xs.length - 1;
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < t.zs.length - 1; b++) {
          const c = a + b * nx;
          const s = i * SMASH_SLOTS + c;
          if (this.rows[s] === 0) continue;
          const x0 = bx0 + t.xs[a] * t.w;
          const x1 = bx0 + t.xs[a + 1] * t.w;
          const z0 = bz0 + t.zs[b] * t.d;
          const z1 = bz0 + t.zs[b + 1] * t.d;
          if (!touches(cx, cz, r, x0, x1, z0, z1)) continue;
          if (cooldownMs > 0) {
            if (now - (this.lastTake.get(s) ?? -Infinity) < cooldownMs) continue;
            this.lastTake.set(s, now);
          }
          const took = Math.min(n, this.rows[s]);
          this.rows[s] -= took;
          this.shown[s] = Math.max(0, this.shown[s] - took);
          // What's left jumps up by what came off, then falls into the gap.
          this.drop[s] += took;
          if (!this.damaged[i]) {
            this.damaged[i] = 1;
            this.since[i] = now;
            this.version++;
          }
          this.moving.add(i);
          hits.push({ x: (x0 + x1) / 2, y: t.floorH / 2, z: (z0 + z1) / 2, target: i, down: false });
        }
      }
      if (hits.length && hits[hits.length - 1].target === i && this.standing(i) === 0) hits[hits.length - 1].down = true;
    }
    return hits;
  }

  /** Floors left in the whole building. */
  standing(target: number): number {
    let sum = 0;
    for (let c = 0; c < cols(this.targets[target]); c++) sum += this.rows[target * SMASH_SLOTS + c];
    return sum;
  }

  /** One row back on every short column per `regenMs` since the last one. */
  private regen(i: number, now: number) {
    const k = Math.floor((now - this.since[i]) / this.regenMs);
    if (k <= 0) return;
    this.since[i] += k * this.regenMs;
    const t = this.targets[i];
    let full = true;
    for (let c = 0; c < cols(t); c++) {
      const s = i * SMASH_SLOTS + c;
      this.rows[s] = Math.min(t.floors, this.rows[s] + k);
      if (this.rows[s] < t.floors) full = false;
    }
    this.moving.add(i);
    if (full) this.damaged[i] = 0;
  }
}

export function cols(t: SmashTarget): number {
  return (t.xs.length - 1) * (t.zs.length - 1);
}
