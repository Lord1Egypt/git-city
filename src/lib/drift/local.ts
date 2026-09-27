// ─── Drift runs in this browser ─────────────────────────────
// Your best run per spot, kept here: the ghost you race when you're signed
// out (or before the board answers), and the run that posts once you sign in
// (PolyTrack keeps guest records the same way). Storage can be blocked: every
// read and write is guarded, and the page works without it.

import type { Frames } from "./frames";
import type { SpotId } from "./spots/types";

export interface LocalRun {
  score: number;
  frames: Frames;
  splits: number[];
  /** Posted to the board already. */
  posted: boolean;
}

const key = (spot: SpotId) => `gc:drift-run:${spot}`;

export function loadRun(spot: SpotId): LocalRun | null {
  try {
    const raw = localStorage.getItem(key(spot));
    if (!raw) return null;
    const r = JSON.parse(raw) as LocalRun;
    return typeof r.score === "number" && Array.isArray(r.frames) ? r : null;
  } catch {
    return null;
  }
}

export function saveRun(spot: SpotId, run: LocalRun): void {
  try {
    localStorage.setItem(key(spot), JSON.stringify(run));
  } catch {
    // storage blocked or full: the run lives until the tab closes
  }
}

/** A flag remembered per browser (hints seen, flyover seen). */
export function seen(name: string): boolean {
  try {
    return localStorage.getItem(`gc:drift-seen:${name}`) === "1";
  } catch {
    return false;
  }
}

export function markSeen(name: string): void {
  try {
    localStorage.setItem(`gc:drift-seen:${name}`, "1");
  } catch {
    // storage blocked
  }
}
