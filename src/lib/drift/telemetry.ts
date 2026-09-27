// ─── Drift HUD state ────────────────────────────────────────
// What the drift world reports to the HUD. Mutated every frame and read in
// requestAnimationFrame, so driving never re-renders React.

import type { DriveTelemetry } from "../league-city/drive/telemetry";
import type { DriftEvent, DriftState } from "./score";

export interface FeedItem {
  kind: DriftEvent["kind"];
  points: number;
  /** performance.now when it happened. */
  at: number;
}

export interface DriftTelemetry extends DriveTelemetry {
  /** The scorer after the latest tick, or null before GO. */
  drift: DriftState | null;
  /** Banks, losses and clips, newest first. */
  feed: FeedItem[];
  /** Latest split against the ghost you race: points ahead (+) or behind (−), and when. */
  split: { delta: number; at: number } | null;
  /** Your car on screen (CSS px), for the combo that rides next to it. */
  carScreen: { x: number; y: number } | null;
  /** 3, 2, 1, 0 at GO; null outside the countdown. */
  countdown: number | null;
  goAt: number;
}

export function createDriftTelemetry(): DriftTelemetry {
  return { speed: 0, boosting: false, drifting: false, near: null, held: null, gotAt: 0, sideHintAt: 0, rebuildFloors: 0, rebuildOf: 0, drift: null, feed: [], split: null, carScreen: null, countdown: null, goAt: 0 };
}
