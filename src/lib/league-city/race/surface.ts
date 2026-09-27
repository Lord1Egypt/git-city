// ─── Track surface ──────────────────────────────────────────
// What's under a point on a track: its asphalt (the town track's road, a
// drift spot's wet docks or mountain road), curbs in the corners (plaza
// grip) or the grass runoff.

import type { Surface, SurfaceGrip } from "../drive/surface";
import { SURFACE, UNIT_TO_M } from "../drive/tuning";
import { curbRuns } from "./layout";
import { locate, type Track } from "./track";

/** Surface under a point in city units. */
export function trackSurface(track: Track, asphalt: Surface = "road"): (wx: number, wz: number) => SurfaceGrip {
  const curbs = curbRuns(track);
  const onCurb = (s: number) => curbs.some(([a, b]) => s >= a && s <= b);
  const road: SurfaceGrip = { surface: asphalt, ...SURFACE[asphalt] };
  const curb: SurfaceGrip = { surface: "plaza", ...SURFACE.plaza };
  const grass: SurfaceGrip = { surface: "grass", ...SURFACE.grass };
  const { width, curb: curbWidth } = track.spec;
  return (wx, wz) => {
    const spot = locate(track, wx * UNIT_TO_M, wz * UNIT_TO_M, 24);
    if (!spot) return grass;
    const d = Math.abs(spot.lateral);
    if (d <= width / 2) return road;
    if (d <= width / 2 + curbWidth && onCurb(spot.s)) return curb;
    return grass;
  };
}
