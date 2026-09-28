// ─── Towns teaser ───────────────────────────────────────────
// The Claude Code vs Codex teaser as a timeline the trailer page plays in
// the engine, so the whole film is one screen recording. Everything counts
// in beats of the 174 BPM track from the first frame, so every cut lands on
// the music without drift. Pure: the page reads it, tests can too.

import type { CityBuilding } from "@/lib/github";
import { LOT, lotToWorld } from "@/lib/league-city/grid";
import type { CityObject } from "@/lib/league-city/types";

export const BPM = 174;
/** Seconds per beat. */
export const BEAT = 60 / BPM;
/** Where the teaser starts in the song (bar 12 of the 174 BPM track). */
export const SONG_OFFSET = 11 * 4 * BEAT;

/** Beat index of a bar (1-indexed) and a beat inside it (1-indexed). */
export const at = (bar: number, beat = 1) => (bar - 1) * 4 + (beat - 1);

export type Stage = "claude" | "codex";

export type ShotKind = "arrival" | "aerial" | "invasion" | "finale";

export interface Shot {
  stage: Stage;
  kind: ShotKind;
  /** Beats, end exclusive. */
  start: number;
  end: number;
}

/** What's on screen: one town full frame, both halves, or black. */
export type Frame = { kind: "full"; stage: Stage } | { kind: "split" } | { kind: "black" };

export const SHOTS: Shot[] = [
  { stage: "claude", kind: "arrival", start: at(1), end: at(2) },
  { stage: "codex", kind: "arrival", start: at(2), end: at(3) },
  { stage: "claude", kind: "aerial", start: at(3), end: at(5) },
  { stage: "codex", kind: "aerial", start: at(3), end: at(5) },
  { stage: "codex", kind: "invasion", start: at(5), end: at(7) },
  { stage: "claude", kind: "invasion", start: at(7), end: at(7, 4) },
  { stage: "codex", kind: "finale", start: at(7, 4), end: at(9) },
];

/** Bomb hits during the invasions: the song's countdown beats. */
export const BLASTS = [at(5, 4), at(6, 3), at(7, 2)];
/** The drop: the Codex tower comes down. */
export const COLLAPSE = at(8);
/** The end card, then the film holds on it. */
export const END = at(9);
export const LENGTH = at(11);

export interface TextCue {
  start: number;
  end: number;
  text: string;
  /** Where it sits: over a half of the split, the middle, or the end card's lines. */
  place: "left" | "right" | "center" | "end1" | "end2" | "end3";
}

export const TEXTS: TextCue[] = [
  { start: at(3), end: at(5), text: "Claude Code", place: "left" },
  { start: at(3, 3), end: at(5), text: "vs", place: "center" },
  { start: at(4), end: at(5), text: "Codex", place: "right" },
  { start: END, end: LENGTH, text: "Pick your side.", place: "end1" },
  { start: at(9, 3), end: LENGTH, text: "Git City Towns", place: "end2" },
  { start: at(10), end: LENGTH, text: "Soon", place: "end3" },
];

/** The scenes the studio lists, in beats. */
export const SCENES: { name: string; start: number; end: number }[] = [
  { name: "Claude arrives", start: at(1), end: at(2) },
  { name: "Codex arrives", start: at(2), end: at(3) },
  { name: "Claude vs Codex", start: at(3), end: at(5) },
  { name: "Codex gets hit", start: at(5), end: at(7) },
  { name: "Claude hits back", start: at(7), end: at(7, 4) },
  { name: "The tower falls", start: at(7, 4), end: at(9) },
  { name: "Pick your side", start: at(9), end: at(11) },
];

export function frameAt(beat: number): Frame {
  if (beat < 0) return { kind: "black" };
  if (beat >= END) return { kind: "black" };
  if (beat >= at(3) && beat < at(5)) return { kind: "split" };
  const shot = [...SHOTS].reverse().find((s) => beat >= s.start) ?? SHOTS[0];
  return { kind: "full", stage: shot.stage };
}

/** This stage's shot at `beat`: the one under way, else the next one waiting on its first frame. */
export function shotFor(stage: Stage, beat: number): { shot: Shot; t: number } {
  const mine = SHOTS.filter((s) => s.stage === stage);
  const now = [...mine].reverse().find((s) => beat >= s.start);
  const shot = now ?? mine[0];
  return { shot, t: Math.max(0, beat - shot.start) * BEAT };
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
        active_drop: null,
      };
    });
    return { x, zs, buildings };
  }
  return null;
}

/** The lot size, for the shots. */
export { LOT };
