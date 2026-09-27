// ─── Drive telemetry ────────────────────────────────────────
// What the car reports to the HUD every frame. A plain mutable object, read
// in requestAnimationFrame by the HUD, so driving never re-renders React.

export interface DriveTelemetry {
  /** m/s, forward. */
  speed: number;
  boosting: boolean;
  drifting: boolean;
  /** Login of the building you can honk at right now. */
  near: string | null;
  /** The attack you hold, and when you got it (performance.now ms). */
  held: string | null;
  gotAt: number;
  /** Rivalry smash: when you last ran into the rival town's buildings without a side (performance.now ms, 0 never). */
  sideHintAt: number;
  /** Rivalry smash: parked against your broken building, its floors standing and in all (0 = not rebuilding). */
  rebuildFloors: number;
  rebuildOf: number;
}

export function createTelemetry(): DriveTelemetry {
  return { speed: 0, boosting: false, drifting: false, near: null, held: null, gotAt: 0, sideHintAt: 0, rebuildFloors: 0, rebuildOf: 0 };
}

export type DriveCameraMode = "chase" | "top";
