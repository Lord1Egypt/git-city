// Every drift spot, in the order /drift lists them. Live ones first; the rest
// open in waves.

import { buildTrack, type Track } from "../../league-city/race/track";
import type { Course } from "../score";
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

export function getSpot(id: string): Spot | null {
  return SPOTS.find((s) => s.id === id) ?? null;
}

export function getLiveSpot(id: string): LiveSpot | null {
  const s = getSpot(id);
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
