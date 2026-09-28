// ─── Film clock ─────────────────────────────────────────────
// Every shot, title and sound of a trailer reads the same clock, in beats of
// the film's music from its first frame. Counting from the start (never
// adding frame deltas) keeps cuts on the beat without drift, and pausing,
// scrubbing and slow motion are just changes to where beat 0 sits.

export interface FilmClock {
  /** Seconds per beat (60 / BPM). */
  beat: number;
  /** performance.now() of beat 0 while it plays. */
  start: number;
  /** Playback speed: below 1 is slow motion. */
  rate: number;
  /** Paused on this beat, or null while it plays. */
  held: number | null;
}

/** Beats since the film's first frame (negative during a pre-roll). */
export function beatOf(clock: FilmClock): number {
  if (clock.held !== null) return clock.held;
  return ((performance.now() - clock.start) * clock.rate) / 1000 / clock.beat;
}

/** The studio's transport: play from a beat, hold on one, change speed. */
export class Transport implements FilmClock {
  start = 0;
  rate = 1;
  held: number | null;
  constructor(
    readonly beat: number,
    at = 0,
  ) {
    this.held = at;
  }
  play(at: number) {
    this.held = null;
    this.start = performance.now() - (at * this.beat * 1000) / this.rate;
  }
  hold(at: number) {
    this.held = at;
  }
  speed(rate: number) {
    const now = beatOf(this);
    this.rate = rate;
    if (this.held === null) this.play(now);
  }
}
