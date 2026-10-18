// Every drift spot, in the order /drift lists them. Live ones first; the rest
// open in waves. A town's own track (TOWN_SPOTS) is live but off the list:
// you drive to it on the town's map.

import { buildTrack, type Track } from "../../league-city/race/track";
import type { Course } from "../score";
import { BRASIL_DRIFT } from "./brasil";
import { HARBOR } from "./harbor";
import { TOUGE } from "./touge";
import type { LiveSpot, Spot, SpotId } from "./types";

export const SPOTS: Spot[] = [
  HARBOR,
  TOUGE,
  { id: "cold-storage", status: "soon", name: "Cold Storage", tagline: "An abandoned data center. Polished concrete between the racks." },
  { id: "salt-flat", status: "soon", name: "Salt Flat", tagline: "A dry lake at sunset. Long drifts round the markers." },
  { id: "permafrost", status: "soon", name: "Permafrost", tagline: "A frozen lake under the aurora. All of it is drift." },
  { id: "spiral", status: "soon", name: "Spiral", tagline: "A neon parking garage. One way, all the way up." },
];

export const TOWN_SPOTS: LiveSpot[] = [BRASIL_DRIFT];

/** A spot on the /drift list. */
export function getSpot(id: string): Spot | null {
  return SPOTS.find((s) => s.id === id) ?? null;
}

/** Any live spot, a town's own track included (runs, boards and ghosts). */
export function getLiveSpot(id: string): LiveSpot | null {
  const s = getSpot(id) ?? TOWN_SPOTS.find((t) => t.id === id) ?? null;
  return s && s.status === "live" ? s : null;
}

const tracks = new Map<SpotId, Track>();

/** A live spot's course, the track built once. */
export function courseOf(spot: LiveSpot): Course {
  let track = tracks.get(spot.id);
  if (!track) {
    track = buildTrack(spot.track);
    tracks.set(spot.id, track);
  }
  return { track, clips: spot.clips };
}
