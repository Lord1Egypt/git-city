// Harbor: the race track down at the docks. A loop of curves: a chicane off
// the line, a long sweeper, an S between two stacks into the pier, a hairpin round
// the crane at the pier's head, and back past a container wall the tail
// grazes on the way to the line (the Meihan wall). Wet asphalt: easy to get
// sideways, hard to hold there.

import { SPRINT } from "../../league-city/race/track";
import { left, path, right, straight } from "./path";
import type { LiveSpot } from "./types";

// Curves all the way: a short run from the grid through a chicane into the sweeper,
// the S, the crane hairpin, the wall. Straights stay under 25 m (no boost here).
const P = path(
  [
    straight(4.481, "quay"),
    right(25, 50),
    left(50, 40),
    right(25, 50),
    left(120, 48, "sweeper"),
    straight(12),
    left(60, 30),
    right(90, 24, "s"),
    straight(19.072),
    left(180, 19, "crane"),
    straight(12),
    right(90, 24),
    left(70, 28),
    right(40, 36),
    left(150, 36, "wall"),
    straight(20, "grid"),
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
  tagline: "The docks by the water. Wet asphalt, a crane hairpin, the container wall.",
  track: {
    ...SPRINT,
    id: "harbor",
    points: P.points,
    closed: true,
    width: 14,
    runoff: 3,
    splits: [4, 8, 11],
  },
  surface: "wet",
  clips: [
    { s: mid("crane") - 8, len: 16, side: 1, kind: "inner", depth: 2.5 },
    { s: mid("wall") - 15, len: 30, side: -1, kind: "outer", depth: 2.5 },
  ],
  author: 50_000,
  minMs: 20_000,
};
