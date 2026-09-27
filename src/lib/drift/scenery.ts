// ─── Drift spot scenery ─────────────────────────────────────
// Where the Kenney models stand around each spot, worked out from its track.
// Every spot keeps the race track and its paddock: covered grandstands along
// the start straight, the pits across from them with tents behind, light posts
// along the walls, banner towers where corners begin, checkered flags at the
// line and billboards facing the famous corners. Then each spot adds its own:
//   Harbor  (after Formula Drift's Long Beach: grandstands on the shoreline)
//           palms, blocks of shipping containers in the loop, tanks, a water
//           tower and chimneys past the far side, the sea around the grass.
//   Touge   (after Ebisu: courses on a forested mountainside) a pine forest,
//           rocks between the switchbacks, logs and fences by the paddock,
//           a small stand at the finish instead of the big ones.
// Meters, like the track. Pure, so it's the same on every load.

import { clearOfTrack, curbRuns, hash, offsetAt, treeSpots } from "../league-city/race/layout";
import { wallOffset, type Track } from "../league-city/race/track";
import type { Clip } from "./score";
import type { SpotId } from "./spots/types";
import type { PropItem, PropKind } from "./props";

/** Facing the track from its left (+1) or right (−1) side, for a heading h. */
const facing = (h: number, side: number) => (side > 0 ? h - Math.PI / 2 : h + Math.PI / 2);

function place(track: Track, s: number, off: number): { x: number; z: number; h: number } {
  const p = offsetAt(track, s, off);
  return { x: p.x, z: p.z, h: Math.atan2(p.tx, p.tz) };
}

function inLoop(t: Track, x: number, z: number): boolean {
  if (!t.closed) return false;
  let inside = false;
  const s = t.samples;
  for (let i = 0, j = s.length - 1; i < s.length; j = i++) {
    const a = s[i];
    const b = s[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function bounds(t: Track) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of t.samples) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Grandstands, pits and tents along the start straight; `big` false for a small paddock. */
function paddock(t: Track, out: PropItem[], big: boolean) {
  const w = wallOffset(t.spec);
  const s0 = t.closed ? -40 : 44;
  const s1 = t.closed ? 56 : 90;
  if (big) {
    for (let s = s0; s <= s1; s += 13.5) {
      const p = place(t, s, -(w + 15));
      if (!clearOfTrack(t, p.x, p.z, w + 10)) continue;
      out.push({ kind: "grandstand", x: p.x, z: p.z, rotY: facing(p.h, -1) });
    }
  }
  const pits = big ? 6 : 3;
  for (let i = 0; i < pits; i++) {
    const p = place(t, s0 + 8 + i * 10.5, w + 13);
    if (!clearOfTrack(t, p.x, p.z, w + 8)) continue;
    out.push({ kind: i === 0 ? "office" : "garage", x: p.x, z: p.z, rotY: facing(p.h, 1) });
  }
  for (let i = 0; i < (big ? 5 : 3); i++) {
    const p = place(t, s0 + 10 + i * 17, w + 34);
    if (!clearOfTrack(t, p.x, p.z, w + 12)) continue;
    out.push({ kind: i % 2 ? "tentLong" : "tentDouble", x: p.x, z: p.z, rotY: facing(p.h, 1) });
  }
  for (const side of [1, -1]) {
    const p = place(t, 0, side * (w + 2.5));
    out.push({ kind: "flagCheckers", x: p.x, z: p.z, rotY: facing(p.h, side) });
  }
}

/** Light posts along both walls, banner towers where corners start, billboards facing the clipping points. */
function trackside(t: Track, clips: readonly Clip[], out: PropItem[]) {
  const w = wallOffset(t.spec);
  let i = 0;
  for (let s = 20; s < t.length - 10; s += 46, i++) {
    const side = i % 2 ? 1 : -1;
    const p = place(t, s, side * (w + 2.2));
    if (!clearOfTrack(t, p.x, p.z, w + 1)) continue;
    out.push({ kind: "lightPost", x: p.x, z: p.z, rotY: facing(p.h, side) });
  }
  for (const [a] of curbRuns(t)) {
    const s = Math.max(2, a);
    const k = t.samples[Math.floor((((s % t.length) + t.length) % t.length) / 2)]?.k ?? 0;
    const side = k > 0 ? -1 : 1; // outside of the turn
    const p = place(t, s, side * (w + 3.5));
    if (!clearOfTrack(t, p.x, p.z, w + 2)) continue;
    out.push({ kind: hash(s) < 0.5 ? "bannerRed" : "bannerGreen", x: p.x, z: p.z, rotY: 0 });
  }
  for (const c of clips) {
    for (const f of [0.2, 0.8]) {
      const side = -c.side; // across the track from the zone, facing it
      const p = place(t, c.s + c.len * f, side * (w + 5));
      if (!clearOfTrack(t, p.x, p.z, w + 3)) continue;
      out.push({ kind: "billboard", x: p.x, z: p.z, rotY: facing(p.h, side) });
    }
  }
}

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.floor(r * list.length) % list.length];
}

function harbor(t: Track, out: PropItem[]) {
  const w = wallOffset(t.spec);
  const b = bounds(t);
  // Palms along the start straight and the quay side, the Long Beach shoreline.
  for (let s = 62; s < 176; s += 12) {
    for (const side of [1, -1]) {
      const p = place(t, s, side * (w + 7 + hash(s * side) * 3));
      if (!clearOfTrack(t, p.x, p.z, w + 3)) continue;
      out.push({ kind: pick(["palm", "palmDetailed"] as const, hash(s + side)), x: p.x, z: p.z, rotY: hash(s * 3) * Math.PI * 2 });
    }
  }
  // Containers: tidy blocks in the loop's yard, one or two high.
  const kinds = ["containerA", "containerB", "containerC"] as const;
  let k = 0;
  for (let x = b.minX; x < b.maxX; x += 14) {
    for (let z = b.minZ; z < b.maxZ; z += 3.2) {
      k++;
      const row = Math.round((z - b.minZ) / 3.2);
      if (row % 5 === 4 || Math.round((x - b.minX) / 14) % 3 === 2) continue;
      if (!inLoop(t, x, z) || !clearOfTrack(t, x, z, w + 10)) continue;
      if (hash(k * 1.7) < 0.3) continue;
      const stack = hash(k * 5.1) < 0.35 ? 2 : 1;
      for (let h = 0; h < stack; h++) out.push({ kind: pick(kinds, hash(k * 9 + h)), x, z, y: h * 2.6, rotY: Math.PI / 2 });
    }
  }
  // Tanks, a water tower and chimneys past the far side of the loop.
  const far = [
    ["tankLarge", 0.2],
    ["tankLarge", 0.35],
    ["tank", 0.45],
    ["waterTower", 0.58],
    ["tankLarge", 0.7],
    ["chimney", 0.8],
    ["chimneyMedium", 0.86],
  ] as const;
  for (const [kind, f] of far) {
    const p = place(t, t.length * f, -(w + 34 + hash(f * 10) * 14));
    if (!clearOfTrack(t, p.x, p.z, w + 20)) continue;
    out.push({ kind, x: p.x, z: p.z, rotY: hash(f) * Math.PI });
  }
  // Trees where the grass is still open.
  treeSpots(t, 180).forEach((s, i) => {
    if (inLoop(t, s.x, s.z) || !clearOfTrack(t, s.x, s.z, w + 8)) return;
    out.push({ kind: pick(["treeDefault", "treeOak", "treeFat", "palm"] as const, hash(i * 3.3)), x: s.x, z: s.z, rotY: hash(i) * Math.PI * 2, scale: 0.8 + s.scale * 0.3 });
  });
}

function touge(t: Track, out: PropItem[]) {
  const w = wallOffset(t.spec);
  // A pine forest all around.
  treeSpots(t, 620).forEach((s, i) => {
    if (!clearOfTrack(t, s.x, s.z, w + 2.5)) return;
    const kind = pick(["pineA", "pineB", "pineC", "pineD", "pineA", "pineRoundA", "pineRoundC"] as const, hash(i * 2.9));
    out.push({ kind, x: s.x, z: s.z, rotY: hash(i) * Math.PI * 2, scale: 0.8 + s.scale * 0.35 });
  });
  // Rocks in the strips between the switchbacks and along the drop side.
  const b = bounds(t);
  let k = 0;
  for (let x = b.minX - 20; x < b.maxX + 20; x += 7) {
    for (let z = b.minZ - 20; z < b.maxZ + 20; z += 7) {
      k++;
      if (!clearOfTrack(t, x, z, w + 1.5) || clearOfTrack(t, x, z, w + 9)) continue;
      if (hash(k * 4.3) < 0.55) continue;
      const kind = pick(["rockTallA", "rockTallC", "rockTallE", "rockLargeA", "rockLargeC", "stoneTall"] as const, hash(k * 7.1));
      out.push({ kind, x: x + hash(k) * 3, z: z + hash(k * 2) * 3, rotY: hash(k * 5) * Math.PI * 2, scale: 0.7 + hash(k * 8) * 0.6 });
    }
  }
  // Logs, stumps and a fence by the paddock; a small stand at the finish.
  for (let i = 0; i < 6; i++) {
    const p = place(t, 8 + i * 9, -(w + 6 + hash(i) * 6));
    if (!clearOfTrack(t, p.x, p.z, w + 3)) continue;
    const kind: PropKind = i % 3 === 0 ? "logStackLarge" : i % 3 === 1 ? "logStack" : "stump";
    out.push({ kind, x: p.x, z: p.z, rotY: hash(i * 3) * Math.PI });
  }
  for (let s = 10; s < 60; s += 4) {
    const p = place(t, s, -(w + 3));
    out.push({ kind: "fence", x: p.x, z: p.z, rotY: p.h + Math.PI / 2 });
  }
  for (let i = 0; i < 3; i++) {
    const p = place(t, t.length - 34 + i * 12.5, -(w + 9));
    if (!clearOfTrack(t, p.x, p.z, w + 5)) continue;
    out.push({ kind: "stand", x: p.x, z: p.z, rotY: facing(p.h, -1) });
  }
}

export function sceneryFor(spot: SpotId, t: Track, clips: readonly Clip[]): PropItem[] {
  const out: PropItem[] = [];
  paddock(t, out, spot !== "touge");
  trackside(t, clips, out);
  if (spot === "harbor") harbor(t, out);
  if (spot === "touge") touge(t, out);
  return out;
}
