"use client";

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VehicleMesh } from "@/components/RaidSequence3D";
import { ClaimedGlow } from "@/components/Building3D";

// ─── City-faithful preview scene ───────────────────────────────
// Mirrors CityCanvas: sky-gradient dome, theme lights, ground + grid, and
// a building with lit windows. Lets cosmetics be previewed exactly as they
// look in the real city, across all 4 themes.

export interface PreviewTheme {
  name: string;
  accent: string;
  sky: [number, string][];
  fogColor: string;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  groundColor: string;
  grid: string;
  buildingFace: string;
  windowLit: string[];
  windowOff: string;
  roof: string;
}

// Subset of CityCanvas THEMES (same values) for the 4 themes.
export const PREVIEW_THEMES: PreviewTheme[] = [
  {
    name: "Midnight", accent: "#6090e0",
    sky: [[0, "#000206"], [0.3, "#061428"], [0.55, "#102850"], [0.8, "#061020"], [1, "#020608"]],
    fogColor: "#0a1428", ambientColor: "#4060b0", ambientIntensity: 0.55,
    sunColor: "#7090d0", sunIntensity: 0.75, sunPos: [300, 120, -200],
    fillColor: "#304080", fillIntensity: 0.3, hemiSky: "#5080a0", hemiGround: "#202830", hemiIntensity: 0.5,
    groundColor: "#242c38", grid: "#344050",
    buildingFace: "#101828", windowLit: ["#a0c0f0", "#80a0e0", "#6080c8", "#c0d8f8", "#e0e8ff"], windowOff: "#0c0e18", roof: "#2a3858",
  },
  {
    name: "Emerald", accent: "#f0c060",
    sky: [[0, "#000804"], [0.3, "#002810"], [0.52, "#004828"], [0.75, "#002014"], [1, "#000604"]],
    fogColor: "#0a2014", ambientColor: "#40a060", ambientIntensity: 0.55,
    sunColor: "#70d090", sunIntensity: 0.75, sunPos: [300, 100, -250],
    fillColor: "#20a080", fillIntensity: 0.35, hemiSky: "#50b068", hemiGround: "#183020", hemiIntensity: 0.5,
    groundColor: "#1e3020", grid: "#2c4838",
    buildingFace: "#0c1810", windowLit: ["#0e4429", "#006d32", "#26a641", "#39d353", "#c8e64a"], windowOff: "#060e08", roof: "#1e4028",
  },
  {
    name: "Sunset", accent: "#c8e64a",
    sky: [[0, "#0c0614"], [0.28, "#3a1850"], [0.52, "#d07060"], [0.62, "#f0b070"], [0.85, "#603030"], [1, "#180c10"]],
    fogColor: "#80405a", ambientColor: "#e0a080", ambientIntensity: 0.7,
    sunColor: "#f0b070", sunIntensity: 1.0, sunPos: [400, 120, -300],
    fillColor: "#6050a0", fillIntensity: 0.35, hemiSky: "#d09080", hemiGround: "#4a2828", hemiIntensity: 0.55,
    groundColor: "#3a3038", grid: "#504048",
    buildingFace: "#281828", windowLit: ["#f8d880", "#f0b860", "#e89840", "#d07830", "#f0c060"], windowOff: "#1a1018", roof: "#604050",
  },
  {
    name: "Neon", accent: "#e040c0",
    sky: [[0, "#06001a"], [0.3, "#200440"], [0.52, "#500860"], [0.75, "#180230"], [1, "#06000c"]],
    fogColor: "#1a0830", ambientColor: "#8040c0", ambientIntensity: 0.6,
    sunColor: "#c050e0", sunIntensity: 0.85, sunPos: [300, 100, -200],
    fillColor: "#00c0d0", fillIntensity: 0.4, hemiSky: "#9040d0", hemiGround: "#201028", hemiIntensity: 0.5,
    groundColor: "#2c2038", grid: "#3c2c50",
    buildingFace: "#180830", windowLit: ["#ff40c0", "#c040ff", "#00e0ff", "#40ff80", "#ff8040"], windowOff: "#0a0814", roof: "#3c1858",
  },
];

// Deterministic pseudo-random for stable window pattern
function rng(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function PreviewSky({ stops }: { stops: [number, string][] }) {
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    for (const [s, color] of stops) g.addColorStop(s, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  }, [stops]);
  useEffect(() => () => { mat.map?.dispose(); mat.dispose(); }, [mat]);
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[600, 32, 32]} />
    </mesh>
  );
}

export function PreviewGround({ color, grid }: { color: string; grid: string }) {
  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <gridHelper args={[600, 40, grid, grid]} position={[0, 0, 0]} />
    </group>
  );
}

export function PreviewLights({ theme }: { theme: PreviewTheme }) {
  return (
    <>
      <ambientLight intensity={theme.ambientIntensity * 3} color={theme.ambientColor} />
      <directionalLight position={theme.sunPos} intensity={theme.sunIntensity * 3.5} color={theme.sunColor} />
      <directionalLight position={[-200, 60, 200]} intensity={theme.fillIntensity * 3} color={theme.fillColor} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity * 3.5]} />
    </>
  );
}

// Procedural window texture matching the real city (Building3D / ShopPreview):
// small dense windows, ~65% lit, emissive on the bright cells.
function windowTexture(rows: number, cols: number, seed: number, litColors: string[], offColor: string, faceColor: string): THREE.CanvasTexture {
  const WS = 6, GAP = 2, PAD = 3;
  const w = PAD * 2 + cols * WS + Math.max(0, cols - 1) * GAP;
  const h = PAD * 2 + rows * WS + Math.max(0, rows - 1) * GAP;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, w, h);
  const rand = rng(seed);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = PAD + col * (WS + GAP);
      const y = PAD + r * (WS + GAP);
      ctx.fillStyle = rand() < 0.62 ? litColors[Math.floor(rand() * litColors.length)] : offColor;
      ctx.fillRect(x, y, WS, WS);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const WHITE = new THREE.Color("#ffffff");

// A building matching the city look: per-face emissive window textures on a
// multi-material box + the claimed neon roofline. `faceOverride` tints the
// base face (used by the `custom_color` cosmetic).
export function PreviewBuilding({ theme, faceOverride, width = 18, height = 40, depth = 18 }: { theme: PreviewTheme; faceOverride?: string; width?: number; height?: number; depth?: number }) {
  const face = faceOverride ?? theme.buildingFace;
  const floors = Math.max(2, Math.round(height / 5));
  const winPerFloor = Math.max(2, Math.round(width / 5));
  const sideWinPerFloor = Math.max(2, Math.round(depth / 5));

  const { front, side } = useMemo(() => ({
    front: windowTexture(floors, winPerFloor, 42 * 137, theme.windowLit, theme.windowOff, face),
    side: windowTexture(floors, sideWinPerFloor, 42 * 137 + 7919, theme.windowLit, theme.windowOff, face),
  }), [floors, winPerFloor, sideWinPerFloor, theme.windowLit, theme.windowOff, face]);

  const materials = useMemo(() => {
    const roofColor = new THREE.Color(theme.roof);
    const roof = new THREE.MeshStandardMaterial({ color: roofColor, emissive: roofColor, emissiveIntensity: 1.2, roughness: 0.6 });
    const makeFace = (t: THREE.CanvasTexture) =>
      new THREE.MeshStandardMaterial({ map: t, emissive: WHITE.clone(), emissiveMap: t, emissiveIntensity: 1.9, roughness: 0.85, metalness: 0 });
    const s = makeFace(side), f = makeFace(front);
    // BoxGeometry face order: [+x, -x, +y, -y, +z, -z] → [side, side, roof, roof, front, front]
    return [s, s, roof, roof, f, f];
  }, [front, side, theme.roof]);

  useEffect(() => () => {
    front.dispose(); side.dispose();
    for (const m of materials) m.dispose();
  }, [front, side, materials]);

  return (
    <group>
      <mesh position={[0, height / 2, 0]} material={materials}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <ClaimedGlow height={height} width={width} depth={depth} />
    </group>
  );
}

// Raid vehicles: rendered standalone (not on a building), slowly spinning —
// reuses the exact game mesh dispatch from RaidSequence3D.
export function PreviewVehicle({ type }: { type: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.5; });
  return (
    <group ref={ref}>
      <VehicleMesh type={type} />
    </group>
  );
}

