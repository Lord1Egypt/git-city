// ─── Towns teaser ───────────────────────────────────────────
// The teaser as a timeline the trailer studio plays in the engine, so the
// film is one screen recording: short gameplay takes, one after another.
// Everything counts in beats from the first frame, so cuts land on the
// music without drift. Pure: the studio reads it, tests can too.

import type { CityBuilding } from "@/lib/github";
import { LOT, lotToWorld } from "@/lib/league-city/grid";
import type { CityObject } from "@/lib/league-city/types";

/** The teaser track (music/make.mjs in the video folder): 150 BPM, a beat is 0.4s, a bar 1.6s. */
export const BPM = 150;
/** Seconds per beat. */
export const BEAT = 60 / BPM;
/** Where the film starts in the song. */
export const SONG_OFFSET = 0;

/** Beat index of a bar (1-indexed) and a beat inside it (1-indexed). */
export const at = (bar: number, beat = 1) => (bar - 1) * 4 + (beat - 1);

/** Orange world (Claude Code's town) or blue (Codex's). */
export type Stage = "claude" | "codex";

export type ShotKind =
  | "rev"
  | "revback"
  | "cornersmash"
  | "drift"
  | "missile"
  | "topdrift"
  | "jump"
  | "boost"
  | "arrival"
  | "aerial"
  | "invasion"
  | "finale";

export interface Shot {
  name: string;
  stage: Stage;
  kind: ShotKind;
  /** Beats, end exclusive. */
  start: number;
  end: number;
  /** Beats of the take's action cut off its start. */
  trim: number;
  /** Shown split with the other town's take at the same time. */
  split: boolean;
}

/** What's on screen: one town full frame, both halves, or black. */
export type Frame = { kind: "full"; stage: Stage } | { kind: "split" } | { kind: "black" };

/**
 * The takes in order, as [name, stage, kind, beats long, trim]: trim is how
 * many beats of the take's own action are cut off its start, so it opens in
 * the thick of it.
 */
const TAKES: [string, Stage | "both", ShotKind, number, number][] = [
  ["Burnout · split", "both", "revback", 4, 0],
  ["Drift", "claude", "drift", 6, 0],
  ["Missile", "codex", "missile", 4, 0],
  ["Top-down drift", "claude", "topdrift", 3, 0.5],
  ["Corner smash", "codex", "cornersmash", 4, 0.5],
  ["Ramp jump", "claude", "jump", 3, 1],
  ["Boost", "codex", "boost", 3, 0],
];

/** "both" is a split take: one shot per town at the same time. */
export const SHOTS: Shot[] = TAKES.reduce<Shot[]>((out, [name, stage, kind, len, trim]) => {
  const start = out.length ? out[out.length - 1].end : 0;
  const stages: Stage[] = stage === "both" ? ["claude", "codex"] : [stage];
  return [
    ...out,
    ...stages.map((st) => ({
      name,
      stage: st,
      kind,
      start,
      end: start + len,
      trim,
      split: stage === "both",
    })),
  ];
}, []);

/** Where a moment of a take's action (beats from its untrimmed start) lands on the timeline. */
export function momentOf(shot: Shot, beats: number): number {
  return shot.start + beats - shot.trim;
}

/** The missile hits on its take's third beat. */
export const MISSILE_HIT = 2;
/** A bomb goes off on the smash take's third beat. */
export const SMASH_BLAST = 2;
/** Beats that flash the screen: the missile hits and the bombs. */
export const BLASTS: number[] = SHOTS.flatMap((s) =>
  s.kind === "missile"
    ? [momentOf(s, MISSILE_HIT)]
    : s.kind === "invasion"
      ? [momentOf(s, SMASH_BLAST)]
      : [],
);
/** The boost take hits its pad on beat 2; the jump leaves the ramp on beat 3. */
export const BOOST_HIT = 1;
export const JUMP_OFF = 2.2;
/** The tower take: the car hits and the tower starts to come down on its third beat. */
const FINALE = SHOTS.find((s) => s.kind === "finale");
export const COLLAPSE = FINALE ? FINALE.start + 2 : -1;
/** Drift take: straight in for this long, then round the corner in this long (s). */
export const DRIFT_IN = 0.3;
/** The drift take drives up the avenue this long before it turns (s). */
export const DRIFT_LEAD = 1.0;
export const DRIFT_ARC = 0.95;
/** The burnout launches this long into its take (s): the track's hit on beat 4. */
export const REV_LAUNCH = 1.2;
/** Corner smash: the car reaches the building's corner at the end of its drift (beats into the take). */
export const CORNER_HIT = (DRIFT_IN + DRIFT_ARC) / BEAT - 0.25;

export interface SoundCue {
  beat: number;
  src: string;
  gain: number;
  /** Cut it off after this long (s), for a looping sound like the skid. */
  dur?: number;
  rate?: number;
}

const SKID = "/sounds/drive/skid.ogg";
const IMPACT = "/sounds/drive/impact.ogg";

/** Sound effects over the music, from each take's own moments. */
export const SOUNDS: SoundCue[] = SHOTS.flatMap((s): SoundCue[] => {
  if (s.kind === "revback" && s.stage === "claude")
    return [{ beat: momentOf(s, REV_LAUNCH / BEAT), src: SKID, gain: 0.7, dur: 0.5, rate: 1.1 }];
  if (s.kind === "cornersmash")
    return [
      { beat: momentOf(s, DRIFT_IN / BEAT), src: SKID, gain: 0.8, dur: DRIFT_ARC },
      { beat: momentOf(s, CORNER_HIT), src: IMPACT, gain: 1 },
      { beat: momentOf(s, CORNER_HIT), src: "/trailer/sfx/explosion.wav", gain: 0.6, rate: 1.2 },
    ];
  if (s.kind === "rev")
    return [{ beat: momentOf(s, REV_LAUNCH / BEAT), src: SKID, gain: 0.55, dur: 0.45, rate: 1.15 }];
  if (s.kind === "drift")
    return [{ beat: momentOf(s, DRIFT_LEAD / BEAT), src: SKID, gain: 0.9, dur: DRIFT_ARC + 0.2 }];
  if (s.kind === "topdrift")
    return [{ beat: momentOf(s, DRIFT_IN / BEAT), src: SKID, gain: 0.8, dur: DRIFT_ARC + 0.2 }];
  if (s.kind === "invasion")
    return [
      { beat: momentOf(s, 1.5), src: IMPACT, gain: 0.8 },
      { beat: momentOf(s, SMASH_BLAST), src: "/trailer/sfx/explosion.wav", gain: 0.9 },
    ];
  if (s.kind === "boost")
    return [{ beat: momentOf(s, BOOST_HIT), src: "/trailer/sfx/whoosh.wav", gain: 0.9, rate: 0.8 }];
  if (s.kind === "jump")
    return [{ beat: momentOf(s, JUMP_OFF), src: "/trailer/sfx/whoosh.wav", gain: 0.6, rate: 0.6 }];
  if (s.kind === "finale")
    return [
      { beat: s.start + 2, src: IMPACT, gain: 1 },
      { beat: s.start + 2, src: "/trailer/sfx/explosion.wav", gain: 1, rate: 0.7 },
      { beat: s.start + 3.5, src: "/trailer/sfx/explosion.wav", gain: 0.7, rate: 0.5 },
    ];
  if (s.kind === "missile")
    return [
      { beat: momentOf(s, 1), src: "/trailer/sfx/whoosh.wav", gain: 0.6 },
      { beat: momentOf(s, MISSILE_HIT), src: "/trailer/sfx/explosion.wav", gain: 1 },
      { beat: momentOf(s, MISSILE_HIT), src: IMPACT, gain: 0.7, rate: 0.8 },
    ];
  return [];
});

export const END = SHOTS[SHOTS.length - 1].end;
export const LENGTH = END;

export interface TextCue {
  start: number;
  end: number;
  text: string;
  /** "tag": a word dropped on a take (a slanted bar wipes in, the letters pop). */
  place: "tag" | "big" | "left" | "right" | "center" | "end1" | "end2" | "end3";
  /** The bar's color: the take's world. */
  color?: string;
}

const ORANGE = "#e07a4f";
const BLUE = "#5b8def";
/** One word per take, on its moment: [take kind, word, beat into the take, big]. */
const TAGS: [ShotKind, string, number, boolean][] = [
  ["drift", "Drift", DRIFT_LEAD / BEAT + 0.5, false],
  ["missile", "Fire", MISSILE_HIT, false],
  ["topdrift", "Slide", 0.75, false],
  ["cornersmash", "Smash", CORNER_HIT, false],
  ["jump", "Fly", JUMP_OFF, false],
  ["boost", "Boost", BOOST_HIT, false],
];

export const TEXTS: TextCue[] = TAGS.flatMap(([kind, text, at, big]) =>
  SHOTS.filter((s) => s.kind === kind).map((s) => ({
    start: momentOf(s, at),
    end: s.end,
    text,
    place: big ? ("big" as const) : ("tag" as const),
    color: s.stage === "claude" ? ORANGE : BLUE,
  })),
);

/** The scenes the studio lists: one per take (a split take is two shots). */
export const SCENES = SHOTS.filter((s, i) => i === 0 || SHOTS[i - 1].start !== s.start).map(
  (s) => ({
    name: s.name,
    start: s.start,
    end: s.end,
  }),
);

export function frameAt(beat: number): Frame {
  if (beat < 0 || beat >= END) return { kind: "black" };
  const shot = [...SHOTS].reverse().find((s) => beat >= s.start) ?? SHOTS[0];
  return shot.split ? { kind: "split" } : { kind: "full", stage: shot.stage };
}

/** This stage's shot at `beat`: the one under way, else the next one waiting on its first frame. */
export function shotFor(stage: Stage, beat: number): { shot: Shot; t: number } {
  const mine = SHOTS.filter((s) => s.stage === stage);
  const now = [...mine].reverse().find((s) => beat >= s.start);
  const shot = now ?? mine[0];
  return { shot, t: (Math.max(0, beat - shot.start) + shot.trim) * BEAT };
}

// ─── The street the car smashes through ─────────────────────
// Both towns are young (a handful of members), so the teaser fills a run of
// empty lots next to the main street with extra buildings for the car to go
// through. They exist only on the trailer page.

/** Lots in a row the car drives up, south to north. */
const RUN = 5;
const EXTRA_HEIGHTS = [96, 132, 78, 150, 190];

export interface SmashRun {
  /** World x of the line the car drives (a lot column's center). */
  x: number;
  /** World z of each lot's center, south to north. */
  zs: number[];
  buildings: CityBuilding[];
}

/**
 * The first column next to the main street with RUN free lots close to the
 * entrance (cross streets in between are fine: the car goes straight over
 * them), filled with buildings, the tallest last.
 */
export function smashRun(
  objects: readonly CityObject[],
  h: number,
  model: CityBuilding,
): SmashRun | null {
  const taken = new Set(objects.map((o) => `${o.x},${o.z}`));
  for (const col of [1, -1, 3, -3]) {
    const rows: number[] = [];
    for (let z = -1; z >= Math.max(-2 * h + 1, -14) && rows.length < RUN; z--)
      if (!taken.has(`${col},${z}`)) rows.push(z);
    if (rows.length < RUN) continue;
    const [x] = lotToWorld(col, rows[0]);
    const zs = rows.map((z) => lotToWorld(col, z)[1]);
    const buildings = zs.map((z, i) => {
      const height = EXTRA_HEIGHTS[i];
      const w = 36 + ((i * 7) % 9);
      const login = `teaser-${col}-${i}`;
      return {
        ...model,
        login,
        loginLower: login,
        position: [x, 0, z] as [number, number, number],
        width: w,
        depth: w,
        height,
        floors: Math.max(3, Math.floor(height / 6)),
        windowsPerFloor: 4,
        sideWindowsPerFloor: 4,
        owned_items: [],
        loadout: null,
        custom_color: null,
        billboard_images: [],
        active_raid_tag: null,
        active_league_crown: null,
        active_drop: null,
      };
    });
    return { x, zs, buildings };
  }
  return null;
}

/** The lot size, for the shots. */
export { LOT };
