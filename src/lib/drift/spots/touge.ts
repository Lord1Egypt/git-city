// Touge: down a mountain pass through the pines. Irohazaka's rhythm (straight,
// hairpin, straight, hairpin), an S to break it, then a double hairpin to the
// finish with a clipping point on each apex. Dry asphalt: it grips, so a
// drift needs speed going in.

import { SPRINT } from "../../league-city/race/track";
import { left, path, right, straight } from "./path";
import type { LiveSpot } from "./types";

const P = path([
  straight(50, "start"),
  right(180, 15),
  straight(80),
  left(180, 15),
  straight(80),
  right(180, 15),
  straight(30),
  left(45, 32),
  right(90, 32),
  left(45, 32),
  straight(40),
  left(180, 13, "dh1"),
  straight(28),
  right(180, 13, "dh2"),
  straight(60, "finish"),
]);

const mid = (name: string) => (P.marks[name][0] + P.marks[name][1]) / 2;

export const TOUGE: LiveSpot = {
  id: "touge",
  status: "live",
  name: "Touge",
  tagline: "A mountain pass through the pines. Switchbacks, then the double hairpin.",
  track: {
    ...SPRINT,
    id: "touge",
    points: P.points,
    closed: false,
    width: 12,
    runoff: 3,
    splits: [4, 9, 13],
  },
  surface: "asphalt",
  clips: [
    { s: mid("dh1") - 7, len: 14, side: 1, kind: "inner", depth: 2.5 },
    { s: mid("dh2") - 7, len: 14, side: -1, kind: "inner", depth: 2.5 },
  ],
  author: 50_000,
  minMs: 20_000,
};
