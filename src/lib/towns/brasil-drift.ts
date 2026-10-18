// ─── Brasil town: the drift track ───────────────────────────
// A drift course out on open land between São Paulo and Rio, Harbor's loop
// laid down there (lib/drift/spots/brasil.ts). Its lots stay clear: no city
// grows a block into them, no highway, avenue or tree crosses them. The
// START gate is the track's own line, on the site's south side; the DRIFT
// sign stands just south of it, out on the open land.
//
// Pure: lots and meters, no rendering.

import { LOT } from "../league-city/grid";
import { M_TO_UNIT } from "../league-city/drive/tuning";

/** The lots the track, its walls and its paddock take (inclusive). */
export const DRIFT_SITE = { x0: 62, x1: 75, z0: -114, z1: -101 } as const;

export function inDriftSite(x: number, z: number): boolean {
  return x >= DRIFT_SITE.x0 && x <= DRIFT_SITE.x1 && z >= DRIFT_SITE.z0 && z <= DRIFT_SITE.z1;
}

/** The site's middle in meters (the drift spot's unit): the track is centered here. */
export const DRIFT_CENTER_M: [number, number] = [
  (((DRIFT_SITE.x0 + DRIFT_SITE.x1) / 2) * LOT) / M_TO_UNIT,
  (((DRIFT_SITE.z0 + DRIFT_SITE.z1) / 2) * LOT) / M_TO_UNIT,
];

/** Where the DRIFT sign stands (lot): south of the START gate, outside the site. */
export const DRIFT_SIGN_LOT: [number, number] = [67, DRIFT_SITE.z1 + 1];

/** Where "back to the city" puts the car (lot, heading clockwise from north): by the sign, facing away from the gate. */
export const DRIFT_EXIT = { x: 65, z: DRIFT_SITE.z1 + 1, rot: 180 } as const;
