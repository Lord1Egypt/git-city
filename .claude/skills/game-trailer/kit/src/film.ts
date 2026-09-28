// ─── Film ───────────────────────────────────────────────────
// A trailer as data: a list of takes, each a few beats long, laid end to end
// on the music's beat grid. The studio (./Studio) plays a
// Film; a film only says what happens when. Pure, no React.
//
// A take can be "trimmed" (it opens that many beats into its own action, so
// it starts in the thick of it) and "frozen" (the picture holds from a beat
// of its action on). Moments inside a take are counted in beats from its
// untrimmed start, so trimming a take never moves its hits off their beats:
// `momentOf` maps them onto the timeline.

/** A take as written: [name, stage (or "both": every stage at once, a split screen), kind, beats long, trim, freeze]. */
export type Take<S extends string, K extends string> = [
  string,
  S | "both",
  K,
  number,
  number,
  number?,
];

export interface Shot<S extends string = string, K extends string = string> {
  name: string;
  stage: S;
  kind: K;
  /** Beats on the timeline, end exclusive. */
  start: number;
  end: number;
  /** Beats of the take's action cut off its start. */
  trim: number;
  /** Shown split with the other stage's take at the same time. */
  split: boolean;
  /** The picture holds from this beat of the take's action on. */
  freeze?: number;
}

/** What's on screen: one stage full frame, all stages side by side (a split take), or black. */
export type Frame<S extends string = string> =
  | { kind: "full"; stage: S }
  | { kind: "split" }
  | { kind: "black" };

export interface Scene {
  name: string;
  start: number;
  end: number;
}

export interface SoundCue {
  beat: number;
  src: string;
  gain: number;
  /** Cut it off after this long (s), for a looping sound like a skid. */
  dur?: number;
  rate?: number;
}

/** A title over the picture (./Titles draws them). */
export interface TitleCue {
  start: number;
  end: number;
  text: string;
  /** tag: a word on a slanted bar, lower left. big: the same, centred up top. left/right: plates over a split. center: a boxed word. */
  place: "tag" | "big" | "left" | "right" | "center";
  /** The bar's or plate's color. */
  color?: string;
}

/** Everything the studio needs to play a film. */
export interface Film<S extends string = string> {
  /** Seconds per beat. */
  beat: number;
  /** Beats from the first frame to the last. */
  length: number;
  scenes: Scene[];
  sounds: SoundCue[];
  titles: TitleCue[];
  /** Beats that flash the screen white (hits, explosions). */
  flashes: number[];
  /** The music, and where in it the film starts (s). Optional: a film can run silent. */
  song?: { src: string; offset: number };
  frameAt: (beat: number) => Frame<S>;
}

/** Lays the takes end to end; a "both" take becomes one shot per stage at the same time. */
export function buildShots<S extends string, K extends string>(
  takes: Take<S, K>[],
  stages: [S, S],
): Shot<S, K>[] {
  return takes.reduce<Shot<S, K>[]>((out, [name, stage, kind, len, trim, freeze]) => {
    const start = out.length ? out[out.length - 1].end : 0;
    const on: S[] = stage === "both" ? [...stages] : [stage];
    return [
      ...out,
      ...on.map((st) => ({
        name,
        stage: st,
        kind,
        start,
        end: start + len,
        trim,
        freeze,
        split: stage === "both",
      })),
    ];
  }, []);
}

/** Where a moment of a take's action (beats from its untrimmed start) lands on the timeline. */
export function momentOf(shot: Shot, beats: number): number {
  return shot.start + beats - shot.trim;
}

/**
 * This stage's shot at `beat`: the one under way, else its next one waiting
 * on its first frame (so a stage that's off screen is ready for its cut), and
 * seconds into that shot's action (trim added, freeze applied).
 */
export function shotFor<S extends string, K extends string>(
  shots: Shot<S, K>[],
  stage: S,
  beat: number,
  secondsPerBeat: number,
): { shot: Shot<S, K>; t: number } {
  const mine = shots.filter((s) => s.stage === stage);
  if (!mine.length)
    throw new Error(`Stage "${stage}" has no takes: give it one, or don't draw it.`);
  const now = [...mine].reverse().find((s) => beat >= s.start);
  const shot = now ?? mine[0];
  return {
    shot,
    t:
      Math.min(Math.max(0, beat - shot.start) + shot.trim, shot.freeze ?? Infinity) *
      secondsPerBeat,
  };
}

/** The frame at `beat`: black before the first shot and after the last, split for a "both" take. */
export function frameOf<S extends string>(shots: Shot<S>[], beat: number): Frame<S> {
  if (!shots.length) return { kind: "black" };
  const end = shots[shots.length - 1].end;
  if (beat < 0 || beat >= end) return { kind: "black" };
  const shot = [...shots].reverse().find((s) => beat >= s.start) ?? shots[0];
  return shot.split ? { kind: "split" } : { kind: "full", stage: shot.stage };
}

/** One scene per take (a split take is two shots), for the studio's list. */
export function scenesOf(shots: Shot[]): Scene[] {
  return shots
    .filter((s, i) => i === 0 || shots[i - 1].start !== s.start)
    .map((s) => ({ name: s.name, start: s.start, end: s.end }));
}
