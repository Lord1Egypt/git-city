// ─── Demo film ──────────────────────────────────────────────
// The trailer kit's complete example (tools/trailer/README.md): a ~10s
// teaser that needs no data, so it runs on any fork. A procedural street in
// two worlds (day and night), the game's car, and the classic teaser shape:
//
//   hook      a split screen burnout, both cars launch on the music's hit
//   action    a drift round a corner on the chase camera, a word on it
//   climax    a ramp jump that freezes mid-air as the music drops out
//   end card  the name stamped on, a stamp after it, a line, and a button
//
// Read it top to bottom as a tutorial: the takes, then the moments inside
// them (in beats from each take's untrimmed start), then what lands on those
// moments. The shots are drawn by components/trailer/demo/DemoRig.

import { buildShots, frameOf, momentOf, scenesOf, shotFor as filmShotFor, type Film, type Shot as FilmShot, type Take } from "../film";

/** The demo track (tools/trailer/music.mjs, "demo"): 150 BPM, a beat is 0.4s. */
export const BPM = 150;
export const BEAT = 60 / BPM;

export type Stage = "day" | "night";
export type Kind = "burnout" | "drift" | "jump";
export type Shot = FilmShot<Stage, Kind>;

// ─── Takes ──────────────────────────────────────────────────
// [name, stage ("both" = split screen), kind, beats long, trim, freeze]
const TAKES: Take<Stage, Kind>[] = [
  ["Burnout · split", "both", "burnout", 4, 0],
  ["Drift", "day", "drift", 5, 0],
  // Trimmed a beat so it opens on the run-up; frozen mid-air, near the top of the arc.
  ["Jump · freeze", "night", "jump", 5, 1, 3.5],
];

export const SHOTS: Shot[] = buildShots(TAKES, ["day", "night"]);

export function shotFor(stage: Stage, beat: number) {
  return filmShotFor(SHOTS, stage, beat, BEAT);
}

const take = (kind: Kind) => SHOTS.find((s) => s.kind === kind)!;

// ─── Moments (beats from each take's untrimmed start) ───────
/** The burnout launches on beat 3: the music's hit. */
export const LAUNCH = 3;
/** The drift runs up the street for two beats, then throws the tail out. */
export const DRIFT_IN = 2;
/** The jump leaves the ramp here. */
export const TAKEOFF = 2.2;

// ─── The end card ───────────────────────────────────────────
/** It starts on the cut to black after the last take and runs ten beats. */
export const CARD = SHOTS[SHOTS.length - 1].end;
export const LENGTH = CARD + 10;
/** Beats into the card: the name stamps on, the stamp lands, the line types on, the button. */
export const NAME_AT = 1;
export const STAMP_AT = 3;
export const LINE_AT = 5;
export const BUTTON_AT = 8;
/** The car reaches the name this long after the button starts (beats). */
export const BUMP = 0.8;

// ─── What lands on the moments ──────────────────────────────
const SKID = "/sounds/drive/skid.ogg";
const IMPACT = "/sounds/drive/impact.ogg";

export const FILM: Film<Stage> = {
  beat: BEAT,
  length: LENGTH,
  scenes: [...scenesOf(SHOTS), { name: "End card", start: CARD, end: LENGTH }],
  sounds: [
    { beat: momentOf(take("burnout"), LAUNCH), src: SKID, gain: 0.7, dur: 0.5, rate: 1.1 },
    { beat: momentOf(take("drift"), DRIFT_IN), src: SKID, gain: 0.9, dur: 1.1 },
    { beat: momentOf(take("jump"), TAKEOFF), src: "/trailer/sfx/whoosh.wav", gain: 0.6, rate: 0.6 },
    { beat: CARD + BUTTON_AT, src: SKID, gain: 0.6, dur: BUMP * BEAT + 0.1, rate: 1.2 },
    { beat: CARD + BUTTON_AT + BUMP, src: IMPACT, gain: 0.45, rate: 1.4 },
    { beat: CARD + BUTTON_AT + BUMP + 0.4, src: "/trailer/sfx/horn.wav", gain: 0.45 },
  ],
  titles: [
    { start: momentOf(take("drift"), DRIFT_IN + 0.5), end: take("drift").end, text: "Slide", place: "tag", color: "#c8e64a" },
  ],
  flashes: [momentOf(take("burnout"), LAUNCH)],
  song: { src: "/trailer/demo.wav", offset: 0 },
  frameAt: (beat) => frameOf(SHOTS, beat),
};
