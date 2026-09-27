// ─── Track layout ───────────────────────────────────────────
// Everything placed along the track, worked out once from the centerline:
// wall segments (physics and looks share them), curb runs, the start line,
// grandstands, floodlights and trees. Meters, like track.ts.

import { pointAt, wallOffset, type Track } from "./track";

export interface WallSegment {
  x: number;
  z: number;
  /** Length along the track (m). */
  len: number;
  /** Rotation about y (three.js): the segment's local +z runs along it. */
  rotY: number;
  side: 1 | -1;
  /** Index along its side, for alternating colors. */
  i: number;
}

/** Point `off` m to the left of travel (negative: right) at distance s. */
export function offsetAt(t: Track, s: number, off: number): { x: number; z: number; tx: number; tz: number } {
  const p = pointAt(t, s);
  return { x: p.x + p.tz * off, z: p.z - p.tx * off, tx: p.tx, tz: p.tz };
}

/**
 * The walls on both sides, a segment every `every` m, overlapping so corners
 * stay closed. A run (open track) also gets a wall across its start and its
 * finish, so nobody drives off either end.
 */
export function wallSegments(t: Track, every = 6): WallSegment[] {
  const out: WallSegment[] = [];
  const off = wallOffset(t.spec);
  const thick = t.spec.wallThickness;
  const n = Math.round(t.length / every);
  for (const side of [1, -1] as const) {
    for (let i = 0; i < n; i++) {
      const a = offsetAt(t, (i * t.length) / n, side * off);
      const b = offsetAt(t, ((i + 1) * t.length) / n, side * off);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      out.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len: len + thick, rotY: Math.atan2(dx, dz), side, i });
    }
  }
  if (!t.closed) {
    // End caps a few meters past each end, square to the track.
    for (const [s, back] of [[0, -8], [t.length, 8]] as const) {
      const p = pointAt(t, s);
      const x = p.x + p.tx * back;
      const z = p.z + p.tz * back;
      out.push({ x, z, len: 2 * off + thick, rotY: Math.atan2(p.tz, -p.tx), side: 1, i: -1 });
    }
  }
  return out;
}

/** Curvature (1/m) past which a stretch gets curbs. */
const CURB_K = 1 / 70;

/** Runs of track [s0, s1] (m) that get curbs: the corners. */
export function curbRuns(t: Track): [number, number][] {
  const runs: [number, number][] = [];
  const n = t.samples.length;
  // Start a loop's scan on a straight bit so no run wraps past the end; a run scans start to finish.
  let first = t.closed ? t.samples.findIndex((p) => Math.abs(p.k) < CURB_K) : 0;
  if (first < 0) first = 0;
  const step = t.closed ? t.length / n : t.length / (n - 1);
  const last = t.closed ? n : n - 1;
  let open: number | null = null;
  for (let k = 0; k <= last; k++) {
    const p = t.samples[(first + k) % n];
    const s = t.samples[first].s + k * step;
    const on = Math.abs(p.k) >= CURB_K && !(k === last && !t.closed);
    if (on && open === null) open = Math.max(t.closed ? -Infinity : 0, s - 8);
    if (!on && open !== null) {
      runs.push([open, t.closed ? s + 8 : Math.min(t.length, s + 8)]);
      open = null;
    }
  }
  // Padded runs that touch become one, so no two curbs lie on the same spot.
  const merged: [number, number][] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Deterministic 0…1 noise. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface Placed {
  x: number;
  z: number;
  rotY: number;
  s: number;
}

/** Things along one side, every `every` m from s0 to s1, `off` m left of travel (negative: right). */
export function along(t: Track, s0: number, s1: number, every: number, off: number): Placed[] {
  const out: Placed[] = [];
  for (let s = s0; s <= s1; s += every) {
    const p = offsetAt(t, s, off);
    out.push({ x: p.x, z: p.z, rotY: Math.atan2(p.tx, p.tz), s });
  }
  return out;
}

/** True when (x, z) is at least `clear` m from every part of the track. */
export function clearOfTrack(t: Track, x: number, z: number, clear: number): boolean {
  const c2 = clear * clear;
  for (let i = 0; i < t.samples.length; i += 2) {
    const p = t.samples[i];
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < c2) return false;
  }
  return true;
}

/** Trees scattered around, clear of the walls. */
export function treeSpots(t: Track, count: number): { x: number; z: number; scale: number }[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of t.samples) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 90;
  const out: { x: number; z: number; scale: number }[] = [];
  for (let i = 0; out.length < count && i < count * 20; i++) {
    const x = minX - pad + hash(i * 2) * (maxX - minX + 2 * pad);
    const z = minZ - pad + hash(i * 2 + 1) * (maxZ - minZ + 2 * pad);
    if (!clearOfTrack(t, x, z, wallOffset(t.spec) + 10)) continue;
    out.push({ x, z, scale: 0.7 + hash(i * 7) * 0.8 });
  }
  return out;
}
