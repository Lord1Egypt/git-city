// Pista Brasil: Harbor's loop laid on the Brasil town's map, out on open land
// between São Paulo and Rio (lib/towns/brasil-drift.ts). Same legs, clips,
// medals and shortest run as Harbor; only where it starts moves, so the run
// happens in the town's own coordinates and posts to its own board. Not on
// the /drift list: you drive to it.

import { DRIFT_CENTER_M } from "../../towns/brasil-drift";
import { HARBOR, HARBOR_LEGS } from "./harbor";
import { path } from "./path";
import type { LiveSpot } from "./types";

// Harbor's loop from the origin, then started again so its middle sits on the site's.
const home = path(HARBOR_LEGS, [0, 0], [1, 0], true);
const xs = home.points.map((p) => p[0]);
const zs = home.points.map((p) => p[1]);
const start: [number, number] = [
  Math.round(DRIFT_CENTER_M[0] - (Math.min(...xs) + Math.max(...xs)) / 2),
  Math.round(DRIFT_CENTER_M[1] - (Math.min(...zs) + Math.max(...zs)) / 2),
];
const P = path(HARBOR_LEGS, start, [1, 0], true);

export const BRASIL_HARBOR: LiveSpot = {
  ...HARBOR,
  id: "brasil-harbor",
  name: "Pista Brasil",
  tagline: "Entre São Paulo e o Rio. O laço do Harbor em terra firme.",
  track: { ...HARBOR.track, id: "brasil-harbor", points: P.points },
};
