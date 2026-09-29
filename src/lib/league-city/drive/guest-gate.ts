// Guests get pulled over: after a while in the car (or right after winning a
// crown rush) the game stops and git refuses to commit without an author.
// Each stop gets a little louder; `--allow-anonymous` drives on.

const DEV = process.env.NODE_ENV === "development";
/** First stop after this much driving as a guest (5 s in dev, to test it). */
export const GATE_FIRST_MS = DEV ? 5_000 : 90_000;
/** Then again after this much more (10 s in dev). */
export const GATE_AGAIN_MS = DEV ? 10_000 : 180_000;

export type GateReason = "time" | "crown";

export interface GateLine {
  text: string;
  tone: "error" | "warn" | "hint" | "plain";
}

/** Driving time (ms) before stop number `stops` (0 = the first). */
export function gateDueMs(stops: number): number {
  return GATE_FIRST_MS + stops * GATE_AGAIN_MS;
}

/** The command git "ran" for this stop. */
export function gateCommand(reason: GateReason, stops: number): string {
  if (reason === "crown") return 'git commit -m "won crown rush"';
  return stops === 0 ? 'git commit -m "drove around town"' : 'git commit -m "kept driving"';
}

/** What git answers: the real "Author identity unknown", louder each stop. */
export function gateLines(reason: GateReason, stops: number, guest: string, drivenMs: number): GateLine[] {
  const unknown: GateLine[] = [
    { text: "Author identity unknown", tone: "error" },
    { text: "", tone: "plain" },
    { text: "*** Please tell me who you are.", tone: "plain" },
    { text: "", tone: "plain" },
    { text: `fatal: unable to auto-detect email address (got '${guest}@(none)')`, tone: "error" },
  ];
  if (reason === "crown") {
    return [{ text: `error: cannot credit win to ${guest}`, tone: "error" }, { text: "", tone: "plain" }, ...unknown.slice(2)];
  }
  if (stops === 0) return unknown;
  const minutes = Math.max(1, Math.floor(drivenMs / 60_000));
  if (stops === 1) {
    return [
      { text: `warning: ${minutes} min of anonymous driving. nobody to git blame.`, tone: "warn" },
      { text: "", tone: "plain" },
      ...unknown,
    ];
  }
  return [
    { text: `warning: ${minutes} min of anonymous driving. nobody to git blame.`, tone: "warn" },
    { text: "hint: every building here has an author. you're driving past them as nobody.", tone: "hint" },
    { text: "", tone: "plain" },
    ...unknown.slice(2),
  ];
}

/** The stall before the terminal: the engine coughs this long, then dies and the car rolls to a stop. */
export const STALL_SPUTTER_MS = 2400;
/** The terminal opens once the car is this slow (m/s)… */
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

/** The car has stopped (or stalled long enough): open the terminal. */
export function stallDone(t: number, speed: number): boolean {
  return t >= STALL_MAX_MS || (t >= STALL_SPUTTER_MS && Math.abs(speed) < STALL_STOPPED);
}
