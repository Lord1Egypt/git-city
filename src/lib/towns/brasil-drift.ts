// ─── Brasil town: the drift track ───────────────────────────
// A drift course out on open land between São Paulo and Mato Grosso do Sul,
// Harbor's loop laid down there turned to face west (lib/drift/spots/
// brasil.ts), clear of the Rio Grande. Its lots stay clear: no city grows a
// block into them, no highway, avenue or tree crosses them. The START gate
// is the track's own line, on the site's north side, a lot off the MS–GO
// highway; the DRIFT sign stands between the two.
//
// Pure: lots and meters, no rendering.

import { LOT } from "../league-city/grid";
import { M_TO_UNIT } from "../league-city/drive/tuning";
import { pointAt, type Track } from "../league-city/race/track";

/** The lots the track, its walls and its paddock take (inclusive). */
export const DRIFT_SITE = { x0: 22, x1: 35, z0: -116, z1: -103 } as const;

/** Which way the start straight runs (x, z): west, so the line sits on the site's north side, by the highway. */
export const DRIFT_HEADING: [number, number] = [-1, 0];

export function inDriftSite(x: number, z: number): boolean {
  return x >= DRIFT_SITE.x0 && x <= DRIFT_SITE.x1 && z >= DRIFT_SITE.z0 && z <= DRIFT_SITE.z1;
}

/** The site's middle in meters (the drift spot's unit): the track is centered here. */
export const DRIFT_CENTER_M: [number, number] = [
  (((DRIFT_SITE.x0 + DRIFT_SITE.x1) / 2) * LOT) / M_TO_UNIT,
  (((DRIFT_SITE.z0 + DRIFT_SITE.z1) / 2) * LOT) / M_TO_UNIT,
];

/** The MS–GO highway's row (lot z), just north of the site. */
export const DRIFT_HIGHWAY_Z = -118;

/** Where the DRIFT sign stands (lot): between the highway and the START gate, outside the site. */
export const DRIFT_SIGN_LOT: [number, number] = [30, DRIFT_SITE.z0 - 1];

/** Where "back to the city" puts the car (lot, heading clockwise from north): on the highway by the sign, headed east for São Paulo. */
export const DRIFT_EXIT = { x: 33, z: DRIFT_HIGHWAY_Z, rot: 90 } as const;

/**
 * Whether the car (units) just crossed the START line between two looks:
 * across it, within the asphalt, close enough that it isn't a jump across
 * the map (a respawn).
 */
export function crossedStart(track: Track, prev: { x: number; z: number }, now: { x: number; z: number }): boolean {
  const p = pointAt(track, 0);
  const local = (q: { x: number; z: number }) => {
    const dx = q.x / M_TO_UNIT - p.x;
    const dz = q.z / M_TO_UNIT - p.z;
    return { along: dx * p.tx + dz * p.tz, lat: dx * p.tz - dz * p.tx };
  };
  const a = local(prev);
  const b = local(now);
  const half = track.spec.width / 2 + 1;
  if (Math.abs(b.lat) > half || Math.abs(a.lat) > half + 4) return false;
  if (Math.hypot(now.x - prev.x, now.z - prev.z) / M_TO_UNIT > 30) return false;
  return Math.sign(a.along) !== Math.sign(b.along) || Math.abs(b.along) < 0.5;
}

/** Far enough from the line (m) for the gate to take the car again. */
export function clearOfStart(track: Track, at: { x: number; z: number }): boolean {
  const p = pointAt(track, 0);
  return Math.hypot(at.x / M_TO_UNIT - p.x, at.z / M_TO_UNIT - p.z) > 25;
}
