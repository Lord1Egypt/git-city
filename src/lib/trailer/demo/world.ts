// ─── The demo's world ───────────────────────────────────────
// Where things are in the demo film's street grid (drawn by
// components/trailer/demo/DemoWorld, used by the shots in DemoRig). World
// units; north is −z. Streets are ROAD wide, avenues run north-south every
// AVENUE (the main street at x = 0), cross streets east-west every BLOCK.

import { RAMP_BIG } from "@/lib/league-city/ramp";

export const ROAD = 24;
export const AVENUE = 130;
export const BLOCK = 150;
/** The first cross street; the others are BLOCK apart to the north and south. */
export const CROSS_Z = 0;
/** The cars drive on the right: the northbound lane of an avenue is this far east of its middle. */
export const LANE = 6;

/** The burnout: both cars wait here on the main street, mid-block. */
export const PARK_Z = CROSS_Z + 60;
/** The drift: the cross street it turns right into. */
export const TURN_Z = CROSS_Z - BLOCK;
/** The jump: the cross street the car flies over, and the ramp whose lip is at its near edge. */
export const JUMP_Z = CROSS_Z - 2 * BLOCK;
export const RAMP_Z = JUMP_Z + LANE + RAMP_BIG.length / 2;
