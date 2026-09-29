// ─── Drive volume ───────────────────────────────────────────
// One master volume (0…1) for everything the car makes: engine, skid, crashes,
// horns, other cars and the chimes. Applied to Howler's master gain, which
// all of them route through. Kept per browser, next to the mute toggle.

const KEY = "gc:drive-volume";

export function loadVolume(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return localStorage.getItem(KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}

export function saveVolume(v: number): void {
  try {
    localStorage.setItem(KEY, String(Math.round(v * 100) / 100));
  } catch {
    // storage blocked
  }
}
