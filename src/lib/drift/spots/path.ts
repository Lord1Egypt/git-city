// ─── Spot paths ─────────────────────────────────────────────
// A drift spot's centerline written like a driver reads it: straights and
// corners (left or right, degrees, radius), turned into control points every
// few meters for buildTrack. Named legs give the distance range where they
// sit, for clipping points and scenery. Meters, x east, z south; left of
// travel is (dz, -dx), as in track.ts.

export type Leg =
  | { kind: "straight"; len: number; name?: string }
  | { kind: "turn"; dir: "L" | "R"; deg: number; r: number; name?: string };

export const straight = (len: number, name?: string): Leg => ({ kind: "straight", len, name });
export const left = (deg: number, r: number, name?: string): Leg => ({ kind: "turn", dir: "L", deg, r, name });
export const right = (deg: number, r: number, name?: string): Leg => ({ kind: "turn", dir: "R", deg, r, name });

export interface Path {
  points: [number, number][];
  /** Where each named leg starts and ends along the path (m). */
  marks: Record<string, [number, number]>;
  length: number;
  /** Where the path ends, and how far that is from where it started (a loop should be ~0). */
  end: [number, number];
  gap: number;
}

const STEP = 4;

export function path(legs: readonly Leg[], start: [number, number] = [0, 0], heading: [number, number] = [1, 0], closed = false): Path {
  let [x, z] = start;
  let [dx, dz] = heading;
  const points: [number, number][] = [[x, z]];
  const marks: Record<string, [number, number]> = {};
  let s = 0;
  for (const leg of legs) {
    const s0 = s;
    const len = leg.kind === "straight" ? leg.len : (leg.deg * Math.PI * leg.r) / 180;
    const n = Math.max(1, Math.round(len / STEP));
    for (let i = 1; i <= n; i++) {
      const d = len / n;
      if (leg.kind === "straight") {
        x += dx * d;
        z += dz * d;
      } else {
        // Advance along the arc: turn half the step, move, turn the other half.
        const a = (d / leg.r) * (leg.dir === "L" ? -1 : 1);
        const turn = (t: number) => {
          const c = Math.cos(t);
          const sn = Math.sin(t);
          [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c];
        };
        turn(a / 2);
        const chord = 2 * leg.r * Math.sin(Math.abs(a) / 2);
        x += dx * chord;
        z += dz * chord;
        turn(a / 2);
      }
      points.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    }
    s += len;
    if (leg.name) marks[leg.name] = [s0, s];
  }
  const gap = Math.hypot(x - start[0], z - start[1]);
  // A loop's last point is its first: drop it so buildTrack closes the curve itself.
  if (closed && gap < STEP) points.pop();
  return { points, marks, length: s, end: [x, z], gap };
}
