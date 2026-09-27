// ─── Chase camera rig ───────────────────────────────────────
// Where the chase camera sits behind the car, city units. A phone held upright
// sees a narrow slice sideways, so there the camera goes higher and further
// back with a wider lens and looks further down the road, keeping the car in
// the lower third (Mario Kart Tour's framing). The town intro ends on this
// same framing, so the drive camera takes over without a move.

import { CAMERA, M_TO_UNIT } from "./tuning";

export interface ChaseRig {
  back: number;
  up: number;
  /** Look this far ahead of the car, and this high. */
  ahead: number;
  lookUp: number;
  /** Vertical field of view (deg) at rest, and at full boost. */
  fov: number;
  fovBoost: number;
}

export function chaseRig(aspect: number): ChaseRig {
  if (aspect >= 1) {
    return { back: CAMERA.distance * M_TO_UNIT, up: CAMERA.height * M_TO_UNIT, ahead: 6, lookUp: 3, fov: CAMERA.fov, fovBoost: CAMERA.fovBoost };
  }
  return { back: CAMERA.distance * M_TO_UNIT * 1.5, up: CAMERA.height * M_TO_UNIT * 1.9, ahead: 16, lookUp: 1, fov: 72, fovBoost: 84 };
}
