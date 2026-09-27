// Harbor: the docks at night, in the rain. A loop along the quay, a long
// sweeper at its end, an S between two stacks into the pier, a hairpin round
// the crane at the pier's head, and back past a container wall the tail
// grazes on the way to the line (the Meihan wall). Wet asphalt: easy to get
// sideways, hard to hold there.

import { SPRINT } from "../../league-city/race/track";
import { left, path, right, straight } from "./path";
import type { LiveSpot } from "./types";

const P = path(
  [
    straight(176.7, "quay"),
    left(120, 52, "sweeper"),
    straight(47.5, "east"),
    left(60, 32),
    straight(20),
    right(90, 26, "s"),
    straight(50, "pier"),
    left(180, 19, "crane"),
    straight(50),
    right(90, 26),
    straight(25),
    left(70, 30),
    straight(25),
    right(40, 40),
    left(150, 38, "wall"),
  ],
  [0, 0],
  [1, 0],
  true,
);

const mid = (name: string) => (P.marks[name][0] + P.marks[name][1]) / 2;

export const HARBOR: LiveSpot = {
  id: "harbor",
  status: "live",
  name: "Harbor",
  tagline: "Docks at night. Wet asphalt, a crane hairpin, the container wall.",
  track: {
    ...SPRINT,
    id: "harbor",
    points: P.points,
    closed: true,
    width: 14,
    runoff: 3,
    splits: [5, 10, 16],
  },
  surface: "wet",
  clips: [
    { s: mid("crane") - 8, len: 16, side: 1, kind: "inner", depth: 2.5 },
    { s: mid("wall") - 15, len: 30, side: -1, kind: "outer", depth: 2.5 },
  ],
  author: 60_000,
  minMs: 25_000,
};
