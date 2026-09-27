// Touge: down a mountain pass through the pines. Irohazaka's rhythm (straight,
// hairpin, straight, hairpin), an S to break it, then a double hairpin to the
// finish with a clipping point on each apex. Dry asphalt: it grips, so a
// drift needs speed going in.

import { SPRINT } from "../../league-city/race/track";
import { left, path, right, straight } from "./path";
import type { LiveSpot } from "./types";

// Switchback after switchback with short straights between (no boost here), an S,
// the double hairpin, then 70 m past the finish to brake on.
const RUNOUT = 70;
const P = path([
  straight(60, "start"),
  right(180, 15),
  straight(22),
  left(180, 15),
  straight(22),
  right(180, 15),
  straight(22),
  left(180, 15),
  straight(10),
  left(45, 30),
  right(90, 30),
  left(45, 30),
  straight(12),
  left(180, 13, "dh1"),
  straight(18),
  right(180, 13, "dh2"),
  straight(20, "finish"),
  straight(RUNOUT, "runout"),
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
    splits: [3, 7, 11],
    runout: RUNOUT,
  },
  surface: "asphalt",
  clips: [
    { s: mid("dh1") - 7, len: 14, side: 1, kind: "inner", depth: 2.5 },
    { s: mid("dh2") - 7, len: 14, side: -1, kind: "inner", depth: 2.5 },
  ],
  author: 45_000,
  minMs: 18_000,
};
