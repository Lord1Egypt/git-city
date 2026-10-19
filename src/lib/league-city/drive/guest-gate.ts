// Guests get pulled over (GuestGate): a sign-in choice as soon as the car is
// theirs, again after a little driving, then every minute, and right after a
// crown rush win. The timed stops run out of gas first. Only signing in ends it.

const DEV = process.env.NODE_ENV === "development";
/** First timed stop after this much driving as a guest (5 s in dev, to test it). */
export const GATE_FIRST_MS = DEV ? 5_000 : 30_000;
/** Then again after this much more (10 s in dev). */
export const GATE_AGAIN_MS = DEV ? 10_000 : 60_000;

/**
 * start: the car was just handed over (no stall). time: driving long enough.
 * crown: won a crown rush. taste: the guest's free building just fell (no stall).
 */
export type GateReason = "start" | "time" | "crown" | "taste";

/** Driving time (ms) before timed stop number `stops` (0 = the first). */
export function gateDueMs(stops: number): number {
  return GATE_FIRST_MS + stops * GATE_AGAIN_MS;
}

/** The stall before the choice: the engine coughs this long, then dies and the car rolls to a stop. */
export const STALL_SPUTTER_MS = 2400;
/** The choice opens once the car is this slow (m/s)… */
export const STALL_STOPPED = 1.5;
/** …or after this long, whatever. */
export const STALL_MAX_MS = 6500;
/** Engine catching / cutting out while it coughs (ms), uneven and slowing down on purpose. */
const BEATS = [300, 220, 260, 240, 200, 300, 160, 380, 120];
/** Each cough jerks the car with a short stab of brake this long (ms). */
const JERK_MS = 130;

/** When each cough (engine cutting out) starts, ms into the stall. */
export const COUGHS: number[] = (() => {
  const out: number[] = [];
  let at = 0;
  BEATS.forEach((b, i) => {
    if (i % 2 === 1) out.push(at);
    at += b;
  });
  out.push(at); // the last one: it dies
  return out;
})();

/** Is the engine catching `t` ms into the sputter? */
function catching(t: number): boolean {
  let at = 0;
  for (let i = 0; i < BEATS.length; i++) {
    at += BEATS[i];
    if (t < at) return i % 2 === 0;
  }
  return false;
}

/** Your input while the car runs out of gas: the throttle coughs out with a jerk each time, no boost, then a soft brake to a stop. Steering stays yours. */
export function stallInput<T extends { throttle: number; brake: number; boost: boolean; handbrake: boolean; fire: boolean }>(input: T, t: number, speed: number): T {
  const out = { ...input, boost: false, handbrake: false, fire: false };
  // Only while rolling forward: a brake at a standstill would reverse.
  const rolling = speed > STALL_STOPPED;
  if (t < STALL_SPUTTER_MS) {
    const on = catching(t);
    // Catching: it pulls with whatever you hold, or a little anyway, so the next cut is felt.
    out.throttle = on ? Math.max(input.throttle, 0.6) : 0;
    out.brake = !on && rolling && COUGHS.some((c) => t >= c && t < c + JERK_MS) ? 0.5 : 0;
    return out;
  }
  out.throttle = 0;
  out.brake = rolling ? Math.min(0.3, ((t - STALL_SPUTTER_MS) / 2500) * 0.3) : 0;
  return out;
}

/** The car has stopped (or stalled long enough): open the choice. */
export function stallDone(t: number, speed: number): boolean {
  return t >= STALL_MAX_MS || (t >= STALL_SPUTTER_MS && Math.abs(speed) < STALL_STOPPED);
}
