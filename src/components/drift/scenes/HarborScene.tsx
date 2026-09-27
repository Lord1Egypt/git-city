"use client";

import { useMemo } from "react";
import type { CityTheme } from "@/components/city/theme";
import { clearOfTrack, hash, offsetAt } from "@/lib/league-city/race/layout";
import { wallOffset, type Track } from "@/lib/league-city/race/track";
import type { Clip } from "@/lib/drift/score";
import { Barriers, Blinker, Boxes, ClipMarks, Lamps, LightPools, Road, StartGantry, U, flat, loopFill, ribbon, useDispose, type Box } from "./parts";

// Harbor: the container port across the bay from Git City, at night. The
// docks are a slab on dark water, the yard inside the loop and the quay
// outside it stacked with containers, gantry cranes at the pier head and
// along the quay with red lights blinking on top, the city's street lamps
// throwing warm pools on the asphalt, and the container wall on the last
// corner that the tail grazes. The city itself stands on the horizon
// (Skyline, drawn by the world).

// Night-muted container paint: rust, navy, teal, mustard, grey, plum, dirty white.
const CONTAINER = ["#6e3124", "#1e3f5f", "#23564d", "#7d5b1f", "#434956", "#46305f", "#7e838d"];
/** A 40 ft container, meters: long, wide, high. */
const CL = 12;
const CW = 2.5;
const CH = 2.6;

function inLoop(t: Track, x: number, z: number): boolean {
  // Ray cast against the centerline polygon.
  let inside = false;
  const s = t.samples;
  for (let i = 0, j = s.length - 1; i < s.length; j = i++) {
    const a = s[i];
    const b = s[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function nearTrack(t: Track, x: number, z: number, within: number): boolean {
  return !clearOfTrack(t, x, z, within);
}

export default function HarborScene({ track, clips, theme, name }: { track: Track; clips: readonly Clip[]; theme: CityTheme; name: string }) {
  const wall = wallOffset(track.spec);

  // Water all around, and the dock slab: a wide band along the track plus the yard inside the loop.
  const dock = useDispose(useMemo(() => {
    const band = ribbon(track, 0, track.length, wall + 34, -(wall + 34), 0, 4);
    return band;
  }, [track, wall]));
  const yard = useDispose(useMemo(() => loopFill(track, 0.01), [track]));
  const dockMat = useDispose(useMemo(() => flat("#1b2230", 0.18), []));
  const waterMat = useDispose(useMemo(() => {
    const m = flat(theme.waterColor, 0);
    m.emissive.set(theme.waterEmissive);
    m.emissiveIntensity = 0.7;
    return m;
  }, [theme.waterColor, theme.waterEmissive]));
  const edge = useDispose(useMemo(() => ribbon(track, 0, track.length, wall + 34.5, wall + 33.5, 0.05, 4), [track, wall]));
  const edge2 = useDispose(useMemo(() => ribbon(track, 0, track.length, -(wall + 33.5), -(wall + 34.5), 0.05, 4), [track, wall]));
  const edgeMat = useDispose(useMemo(() => flat("#f2c230", 0.6), []));

  // Containers: rows in the yard and along the quay, stacked one to three high,
  // kept clear of the track. On the last corner they stand right behind the
  // barrier, three high: the wall the tail grazes.
  const containers = useMemo<Box[]>(() => {
    const out: Box[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of track.samples) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    let k = 0;
    for (let x = minX - 40; x < maxX + 40; x += CL + 1.5) {
      for (let z = minZ - 40; z < maxZ + 40; z += CW + 0.4) {
        k++;
        const row = Math.floor((z - minZ) / (CW + 0.4));
        if (row % 7 === 6) continue; // lanes between blocks
        const inside = inLoop(track, x, z);
        if (!nearTrack(track, x, z, wall + 30) && !inside) continue;
        // The quay (south of the start straight) stays open to the water: cranes, not boxes.
        if (!inside && z > 4) continue;
        if (nearTrack(track, x, z, wall + 10)) continue;
        if (hash(k * 3.1) < 0.22) continue;
        // Low next to the track, higher further in: the yard reads from the car.
        const far = !nearTrack(track, x, z, wall + 22);
        const stack = 1 + Math.floor(hash(k * 7.7) * (far ? 3 : 2));
        for (let h = 0; h < stack; h++) {
          out.push({ x: x * U, y: h * CH * U, z: z * U, w: CL * U, h: CH * U * 0.96, d: CW * U, rotY: 0, color: CONTAINER[Math.floor(hash(k * 13 + h) * CONTAINER.length)] });
        }
      }
    }
    // The container wall: along the outer clipping zone, end to end, three high.
    for (const c of clips) {
      if (c.kind !== "outer") continue;
      for (let s = c.s - 6; s < c.s + c.len + 6; s += CL * 0.9) {
        const p = offsetAt(track, s, c.side * (wall + CW / 2 + 0.8));
        const rot = Math.atan2(p.tx, p.tz);
        for (let h = 0; h < 3; h++) {
          out.push({ x: p.x * U, y: h * CH * U, z: p.z * U, w: CW * U, h: CH * U * 0.96, d: CL * U, rotY: rot, color: CONTAINER[(Math.floor(s / CL) + h) % CONTAINER.length] });
        }
      }
    }
    return out;
  }, [track, clips, wall]);

  // Gantry cranes: one over the pier head, two along the quay, booms out over the water.
  const cranes = useMemo(() => {
    const spots: { s: number; side: number }[] = [
      { s: track.length * 0.555, side: -1 },
      { s: 40, side: -1 },
      { s: 120, side: -1 },
    ];
    const boxes: Box[] = [];
    const lights: [number, number, number][] = [];
    const windows: Box[] = [];
    for (const { s, side } of spots) {
      const base = offsetAt(track, s, side * (wall + 18));
      const out = offsetAt(track, s, side * (wall + 60));
      const along = Math.atan2(base.tx, base.tz);
      const nx = (out.x - base.x) / 42;
      const nz = (out.z - base.z) / 42;
      const H = 34;
      const legs: [number, number][] = [[-6, -5], [6, -5], [-6, 5], [6, 5]];
      for (const [a, b] of legs) {
        const x = base.x + base.tx * a + nx * b;
        const z = base.z + base.tz * a + nz * b;
        boxes.push({ x: x * U, y: 0, z: z * U, w: 1.4 * U, h: H * U, d: 1.4 * U, rotY: along, color: "#b8862c" });
      }
      // Top frame and the boom out over the water, the counterweight behind.
      const topX = base.x + nx * 8;
      const topZ = base.z + nz * 8;
      const rot = Math.atan2(nx, nz);
      boxes.push({ x: topX * U, y: H * U, z: topZ * U, w: 14 * U, h: 2.2 * U, d: 34 * U, rotY: rot, color: "#c29033" });
      const cw = offsetAt(track, s, side * (wall + 9));
      boxes.push({ x: cw.x * U, y: (H - 2) * U, z: cw.z * U, w: 8 * U, h: 5 * U, d: 6 * U, rotY: rot, color: "#6f7686" });
      boxes.push({ x: base.x * U, y: (H - 5) * U, z: base.z * U, w: 5 * U, h: 4 * U, d: 4 * U, rotY: rot, color: "#2b303b" });
      windows.push({ x: base.x * U, y: (H - 4) * U, z: base.z * U, w: 5.2 * U, h: 1.6 * U, d: 3 * U, rotY: rot, color: "#ffd98a" });
      lights.push([topX * U, (H + 2.8) * U, topZ * U]);
      const tip = { x: base.x + nx * 25, z: base.z + nz * 25 };
      lights.push([tip.x * U, (H + 1.8) * U, tip.z * U]);
    }
    return { boxes, lights, windows };
  }, [track, wall]);

  // Pools of light from the cranes' floodlights onto the quay.
  const floods = useMemo<[number, number][]>(() => cranes.lights.filter((_, i) => i % 2 === 1).map(([x, , z]) => [x, z]), [cranes]);

  const reflect = useMemo<Box[]>(() => {
    // Light streaks on the water toward the city (east, past the quay's end), like its windows reflected.
    const out: Box[] = [];
    for (let i = 0; i < 48; i++) {
      const x = (300 + hash(i * 5.3) * 560) * U;
      const z = (-160 + hash(i * 2.1) * 260) * U;
      out.push({ x, y: -1.4, z, w: (1.2 + hash(i) * 2) * U, h: 0.05, d: (20 + hash(i * 9) * 60) * U, rotY: Math.PI / 2, color: hash(i * 4.4) < 0.5 ? "#ffd98a" : "#9fc4ff" });
    }
    return out;
  }, []);

  return (
    <group>
      <mesh position={[0, -1.5, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMat}>
        <planeGeometry args={[40000, 40000]} />
      </mesh>
      <mesh geometry={dock} material={dockMat} />
      <mesh geometry={yard} material={dockMat} />
      <mesh geometry={edge} material={edgeMat} />
      <mesh geometry={edge2} material={edgeMat} />
      <Road track={track} look={{ asphalt: "#161b26", line: theme.roadMarkingColor, curb: ["#d9ad2b", "#15171c"] }} />
      <ClipMarks track={track} clips={clips} colors={["#f2c230", "#1b1d22"]} />
      <Barriers track={track} color="#4e5666" />
      <Boxes boxes={containers} glow={0.16} />
      <Boxes boxes={cranes.boxes} glow={0.22} />
      <Boxes boxes={cranes.windows} glow={1.4} />
      {cranes.lights.map((p, i) => (
        <Blinker key={i} position={p} phase={i * 0.37} />
      ))}
      <LightPools spots={floods} color="#ffe2a8" radius={22 * U} />
      <Lamps track={track} marking={theme.roadMarkingColor} />
      <Boxes boxes={reflect} glow={1.2} />
      <StartGantry track={track} name={name} accent="#c8ff3a" />
    </group>
  );
}
