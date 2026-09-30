"use client";

import "@/lib/silenceThreeClockWarning";
import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BannerPlane, Blimp } from "@/components/SkyAds";
import { AdBillboard, AdRooftopSign } from "@/components/BuildingAds";
import InstancedBuildings from "@/components/InstancedBuildings";
import { createWindowAtlas } from "@/components/Building3D";
import { THEMES, ThemeLights } from "@/components/city/theme";
import type { CityBuilding } from "@/lib/github";
import type { SkyAd } from "@/lib/skyAds";

// A block of Git City in its Midnight theme with the game's own billboard,
// banner plane and blimp, all carrying the typed brand. Drag to orbit.

// The city's default theme (index 0 in THEMES), same palette the home page opens with.
const THEME = THEMES[0];

const AD_COLOR = "#c8e64a";
const AD_BG = "#0b0f19";
const LOT = 30;
const ROAD = 12;
const HERO = { width: 22, depth: 22, height: 120, position: [0, 0, 0] as [number, number, number] };

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Tower = { x: number; z: number; w: number; d: number; h: number };

// A grid of blocks around the hero tower in the middle; streets between blocks.
const TOWERS: Tower[] = (() => {
  const r = rng(20260220);
  const out: Tower[] = [];
  const step = LOT + ROAD;
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      if (gx === 0 && gz === 0) continue;
      const w = 12 + Math.floor(r() * 4) * 4;
      const d = 12 + Math.floor(r() * 4) * 4;
      const dist = Math.hypot(gx, gz);
      const h = Math.max(14, Math.round((100 - dist * 14) * (0.4 + r() * 0.8)));
      out.push({ x: gx * step, z: gz * step, w, d, h });
    }
  }
  return out;
})();

const SIGN_TOWER = {
  width: 20,
  depth: 20,
  height: 84,
  position: [-2 * (LOT + ROAD), 0, 0] as [number, number, number],
};

// Plain boxes shaped as CityBuilding so the game's own renderer draws them.
function toBuilding(t: Tower, i: number): CityBuilding {
  const floors = Math.max(3, Math.floor(t.h / 6));
  return {
    login: `preview-${i}`,
    loginLower: `preview-${i}`,
    position: [t.x, 0, t.z],
    width: t.w,
    depth: t.d,
    height: t.h,
    floors,
    windowsPerFloor: Math.max(3, Math.floor(t.w / 5)),
    sideWindowsPerFloor: Math.max(3, Math.floor(t.d / 5)),
    litPercentage: 0.35 + ((i * 37) % 50) / 100,
  } as unknown as CityBuilding;
}

function City() {
  const buildings = useMemo(() => {
    const extra: Tower[] = [
      { x: 0, z: 0, w: HERO.width, d: HERO.depth, h: HERO.height },
      {
        x: SIGN_TOWER.position[0],
        z: 0,
        w: SIGN_TOWER.width,
        d: SIGN_TOWER.depth,
        h: SIGN_TOWER.height,
      },
    ];
    const lots = TOWERS.filter((t) => !(t.x === SIGN_TOWER.position[0] && t.z === 0));
    return [...lots, ...extra].map(toBuilding);
  }, []);
  const atlas = useMemo(() => createWindowAtlas(THEME.building), []);
  useEffect(() => () => atlas.dispose(), [atlas]);
  const span = 9 * (LOT + ROAD);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[span * 4, span * 4]} />
        <meshStandardMaterial color={THEME.groundColor} />
      </mesh>
      <gridHelper args={[span * 4, 120, THEME.grid1, THEME.grid2]} position={[0, -0.4, 0]} />
      {buildings.map((b) => (
        <mesh
          key={b.login}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[b.position[0], 0.05, b.position[2]]}
        >
          <planeGeometry args={[LOT, LOT]} />
          <meshStandardMaterial color={THEME.sidewalkColor} />
        </mesh>
      ))}
      <InstancedBuildings buildings={buildings} colors={THEME.building} atlasTexture={atlas} />
    </group>
  );
}

export default function CityBrandPreview({ brand }: { brand: string }) {
  const base: SkyAd = useMemo(
    () => ({
      id: "preview",
      text: brand,
      color: AD_COLOR,
      bgColor: AD_BG,
      vehicle: "billboard",
      priority: 0,
    }),
    [brand],
  );

  return (
    <Canvas
      camera={{ position: [130, 150, 210], fov: 45, near: 1, far: 4000 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
    >
      <fog attach="fog" args={[THEME.fogColor, THEME.fogNear, THEME.fogFar]} />
      <ThemeLights theme={THEME} themeIndex={0} />
      <City />
      <AdBillboard ad={base} building={HERO} />
      <AdRooftopSign
       
        ad={{ ...base, vehicle: "rooftop_sign" }}
        building={SIGN_TOWER}
      />
      <Suspense fallback={null}>
        <BannerPlane
         
          ad={{ ...base, vehicle: "plane" }}
          index={0}
          total={1}
          cityRadius={0}
          flyMode={false}
          path={{ cx: 0, cz: 0, r: 120, altitude: 142 }}
        />
        <Blimp
         
          ad={{ ...base, vehicle: "blimp" }}
          index={0}
          total={1}
          cityRadius={0}
          flyMode={false}
          path={{ cx: -40, cz: -30, r: 16, altitude: 158 }}
        />
      </Suspense>
      <OrbitControls
        target={[0, 115, 0]}
        enablePan
        screenSpacePanning
        minDistance={40}
        maxDistance={520}
        maxPolarAngle={Math.PI * 0.49}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}
