// ─── Touch drive ────────────────────────────────────────────
// Phone controls, as Mario Kart Tour settled them for a phone held upright:
// the car drives itself from the first touch, a drag anywhere steers (relative
// to where the finger went down, so any spot works), and steering hard at
// speed drifts by itself. Brake (and reverse), drift, boost, the attack and
// the horn are buttons. The HUD writes this state; useDriveInput merges it with the
// keys and the pad.

import type { DriveInput } from "./input";
import { DRIFT } from "./tuning";

export interface TouchDrive {
  /** The touch controls are on screen. */
  on: boolean;
  /** First touch happened: from here the car drives itself. */
  started: boolean;
  /** -1 left … 1 right. */
  steer: number;
  brake: boolean;
  boost: boolean;
  /** Auto drift (see autoDrift). */
  drift: boolean;
  /** The Drift button, held. */
  driftButton: boolean;
  fire: boolean;
  horn: boolean;
}

export function createTouch(): TouchDrive {
  return { on: false, started: false, steer: 0, brake: false, boost: false, drift: false, driftButton: false, fire: false, horn: false };
}

/** Share of the screen width a full-lock drag takes. */
export const DRAG_RANGE = 0.18;
/** Steering past this at speed, for DRIFT_AFTER seconds, starts a drift… */
export const DRIFT_STEER = 0.85;
export const DRIFT_AFTER = 0.35;
/** …which lasts until the steering eases under this. */
export const DRIFT_RELEASE = 0.35;

/**
 * A drag's steer from where the finger went down (`origin`) and where it is.
 * Past full lock the origin follows the finger, so turning back answers at once.
 */
export function dragSteer(origin: number, x: number, width: number): { steer: number; origin: number } {
  const range = Math.max(48, width * DRAG_RANGE);
  let o = origin;
  if (x - o > range) o = x - range;
  if (o - x > range) o = x + range;
  return { steer: (x - o) / range, origin: o };
}

/** Auto drift: steering hard at speed for a moment drifts, easing off ends it. `held` is seconds steered hard so far. */
export function autoDrift(
  drifting: boolean,
  held: number,
  steer: number,
  speed: number,
  dt: number,
): { drift: boolean; held: number } {
  const hard = Math.abs(steer) >= DRIFT_STEER && speed > DRIFT.minSpeed;
  const h = hard ? held + dt : 0;
  if (drifting) return { drift: Math.abs(steer) >= DRIFT_RELEASE, held: h };
  return { drift: h >= DRIFT_AFTER, held: h };
}

/** Keys and pad, plus the touch controls when they're on. */
export function mergeTouch(input: DriveInput, t: TouchDrive): DriveInput {
  if (!t.on) return input;
  const auto = t.started && !t.brake ? 1 : 0;
  return {
    ...input,
    throttle: Math.max(input.throttle, auto),
    brake: Math.max(input.brake, t.brake ? 1 : 0),
    steer: Math.abs(t.steer) > Math.abs(input.steer) ? t.steer : input.steer,
    handbrake: input.handbrake || t.drift || t.driftButton,
    boost: input.boost || t.boost,
    horn: input.horn || t.horn,
    fire: input.fire || t.fire,
  };
}
