"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rampGeometry } from "@/components/league/LeagueToys";
import { RAMP_BIG } from "@/lib/league-city/ramp";
import type { Stage } from "@/lib/trailer/demo/film";
import { AVENUE, BLOCK, CROSS_Z, JUMP_Z, LANE, RAMP_Z, ROAD } from "@/lib/trailer/demo/world";

// The demo film's world, made in code so it runs on any fork with no data: a
// grid of streets, blocks of box buildings, dashed lane lines and a ramp. One
// layout, two looks: "day" in sun, "night" with lit windows. The windows are
// one tiled texture and the buildings one merged mesh: one draw call for the
// whole city.

const LOOK: Record<
  Stage,
  {
    sky: string;
    fog: [number, number];
    ground: string;
    road: string;
    line: string;
    walls: string[];
    /** Sky light: the color from above, from below, and how strong. */
    hemi: [string, string, number];
    sun: number;
    sunColor: string;
  }
> = {
  day: {
    sky: "#8fd0ea",
    fog: [260, 900],
    ground: "#c9c0ad",
    road: "#3b3f4a",
    line: "#f4e9c8",
    walls: ["#e8dcc8", "#d9b99b", "#b7c9d6", "#e2a57f", "#c8d4a8", "#f0d9a0"],
    hemi: ["#ffffff", "#b8ae98", 1.1],
    sun: 2.2,
    sunColor: "#fff4e0",
  },
  night: {
    sky: "#1c2a66",
    fog: [220, 800],
    ground: "#5a6698",
    road: "#2e3658",
    line: "#9fb0e8",
    walls: ["#4f5a80", "#5c6790", "#454f72", "#66709a"],
    hemi: ["#d8dcf0", "#404a70", 1.7],
    sun: 1.4,
    sunColor: "#9fb0ff",
  },
};

/** A seeded random, so every load builds the same city. */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/**
 * The blocks between the streets: avenues run north-south every AVENUE units
 * (the main street at x = 0), cross streets east-west every BLOCK units from
 * CROSS_Z. Each block holds a 2×3 grid of lots, each lot one building,
 * but for the two lots on the jump's west corners: the jump's camera looks
 * across them at the ramp and the car in the air.
 */
function layout(): Box[] {
  const r = rng(11);
  const out: Box[] = [];
  const half = ROAD / 2 + 4;
  for (let ax = -3; ax < 3; ax++) {
    const x0 = ax * AVENUE + half;
    const x1 = (ax + 1) * AVENUE - half;
    for (let bz = -2; bz < 6; bz++) {
      const z1 = CROSS_Z - bz * BLOCK - half;
      const z0 = CROSS_Z - (bz + 1) * BLOCK + half;
      const lw = (x1 - x0) / 2;
      const ld = (z1 - z0) / 3;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 3; j++) {
          const w = lw - 3 - r() * 8;
          const d = ld - 3 - r() * 8;
          const x = x0 + lw * (i + 0.5);
          const z = z0 + ld * (j + 0.5);
          const h = 16 + Math.floor(r() * 7) * 12 * (r() < 0.2 ? 1.8 : 1);
          if (Math.hypot(x + 40, Math.abs(z - JUMP_Z) - 36) < 30) continue;
          out.push({ x, z, w, d, h });
        }
    }
  }
  return out;
}

/** Window grid: one window per WIN_W × WIN_H of wall; the texture holds TILE × TILE windows. */
const WIN_W = 3.2;
const WIN_H = 4;
const TILE = 8;

/**
 * The window texture, tiled over every wall: by day glass on a white wall
 * (the wall's color comes from the vertex colors), by night a glow map with
 * a random half of the windows lit. Pixel (0, 0) is plain wall: the roofs
 * sample only that.
 */
function windowTexture(night: boolean) {
  const px = 8;
  const c = document.createElement("canvas");
  c.width = c.height = TILE * px;
  const g = c.getContext("2d")!;
  g.fillStyle = night ? "#000" : "#fff";
  g.fillRect(0, 0, c.width, c.height);
  const r = rng(night ? 5 : 3);
  for (let i = 0; i < TILE; i++)
    for (let j = 0; j < TILE; j++) {
      const lit = r();
      g.fillStyle = night
        ? lit > 0.5
          ? "#ffd76a"
          : "#000"
        : lit > 0.5
          ? "#8fb4cf"
          : "#6f93b0";
      g.fillRect(i * px + 2, j * px + 2, px - 4, px - 3);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Every building merged into one geometry: walls' UVs count windows, roofs sample plain wall. */
function cityGeometry(boxes: Box[], walls: string[]) {
  const c = new THREE.Color();
  const parts = boxes.map((b, i) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d).translate(b.x, b.h / 2, b.z);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    // BoxGeometry's faces, 4 vertices each: +x, −x, +y, −y, +z, −z.
    for (let v = 0; v < uv.count; v++) {
      const face = Math.floor(v / 4);
      const across = face < 2 ? b.d : b.w;
      if (face === 2 || face === 3) uv.setXY(v, 0.01, 0.01);
      else uv.setXY(v, (uv.getX(v) * across) / WIN_W / TILE, (uv.getY(v) * b.h) / WIN_H / TILE);
    }
    c.set(walls[i % walls.length]);
    g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: uv.count }, () => [c.r, c.g, c.b]).flat(), 3));
    return g;
  });
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged;
}

function Buildings({ stage }: { stage: Stage }) {
  const night = stage === "night";
  const geo = useMemo(() => cityGeometry(layout(), LOOK[stage].walls), [stage]);
  const tex = useMemo(() => windowTexture(night), [night]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh geometry={geo}>
      {night ? (
        <meshLambertMaterial vertexColors emissive="#ffffff" emissiveMap={tex} />
      ) : (
        <meshLambertMaterial vertexColors map={tex} />
      )}
    </mesh>
  );
}

/** Dashed lines down the middle of every street. */
function Lines({ color }: { color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dashes = useMemo(() => {
    const out: [number, number, boolean][] = [];
    for (let ax = -3; ax <= 3; ax++)
      for (let z = CROSS_Z + 3 * BLOCK; z > CROSS_Z - 6 * BLOCK; z -= 12) out.push([ax * AVENUE, z, true]);
    for (let bz = -2; bz <= 6; bz++)
      for (let x = -3 * AVENUE; x < 3 * AVENUE; x += 12) out.push([x, CROSS_Z - bz * BLOCK, false]);
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    dashes.forEach(([x, z, ns], i) => {
      o.position.set(x, 0.06, z);
      o.rotation.set(-Math.PI / 2, 0, ns ? 0 : Math.PI / 2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dashes]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dashes.length]}>
      <planeGeometry args={[0.6, 5]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
}

export default function DemoWorld({ stage }: { stage: Stage }) {
  const look = LOOK[stage];
  const ramp = useMemo(() => rampGeometry(RAMP_BIG), []);
  const span = 7 * AVENUE;
  const depth = 10 * BLOCK;
  return (
    <>
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, ...look.fog]} />
      <hemisphereLight args={look.hemi} />
      <directionalLight position={[-120, 200, 80]} intensity={look.sun} color={look.sunColor} />
      {/* Ground (the sidewalks and lots), then the streets on top of it. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, CROSS_Z - 2 * BLOCK]}>
        <planeGeometry args={[span * 2, depth * 2]} />
        <meshLambertMaterial color={look.ground} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={`a${i}`} rotation-x={-Math.PI / 2} position={[(i - 3) * AVENUE, 0.03, CROSS_Z - 2 * BLOCK]}>
          <planeGeometry args={[ROAD, depth]} />
          <meshLambertMaterial color={look.road} />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`c${i}`} rotation-x={-Math.PI / 2} position={[0, 0.04, CROSS_Z - (i - 2) * BLOCK]}>
          <planeGeometry args={[span, ROAD]} />
          <meshLambertMaterial color={look.road} />
        </mesh>
      ))}
      <Lines color={look.line} />
      <Buildings stage={stage} />
      {/* The jump's ramp, on the main street's right lane, rising to the north. */}
      <mesh geometry={ramp} position={[LANE, 0, RAMP_Z]}>
        <meshLambertMaterial vertexColors />
      </mesh>
    </>
  );
}
