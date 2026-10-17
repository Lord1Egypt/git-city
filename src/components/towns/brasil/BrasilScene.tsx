"use client";

import "@/lib/silenceThreeClockWarning";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, MapControls } from "@react-three/drei";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import CityScene from "@/components/CityScene";
import { ThemeLights } from "@/components/city/theme";
import ThemeSkyFX from "@/components/ThemeSkyFX";
import { EXPOSURE, townTheme } from "@/components/league/townTheme";
import IdentityLayer, { useFontReady } from "@/components/league/identity/IdentityLayer";
import { makeWaterMaterial, tickWater } from "@/components/city/mapMaterials";
import { Billboard } from "@/components/league/identity/IdentityPieces";
import LeagueRoads from "@/components/league/LeagueRoads";
import LeagueTrees from "@/components/league/LeagueTrees";
import type { DriveWorldProps } from "@/components/league/drive/DriveWorld";
import type { CityBuilding, CityDecoration } from "@/lib/github";
import { InstancedDecorations } from "@/components/city/decorations";
import { LOT, lotToWorld } from "@/lib/league-city/grid";
import type { CityObject } from "@/lib/league-city/types";
import type { SmashStore } from "@/lib/league-city/smash";
import { MAP_BOUNDS, MAP_H, OUTLINE, RIVERS, STATE_RINGS, type Ring } from "@/lib/towns/brasil-geo";
import { stateOf, type CityLayout, type UF } from "@/lib/towns/brasil-map";

// The Brasil town: the country on its real outline under the towns' night
// sky, a pale coast, the states' borders dashed in lime, a city in every
// state paved like a town, highway streets between neighboring capitals, the
// island out at sea.
// Over every city floats its tag (the state, the founder, how many devs);
// a tag flies the camera to its city. The camera is a map's: drag to pan,
// right-drag to turn, scroll to zoom. Drive mode is the towns' (DriveWorld).

const DriveWorld = dynamic(() => import("@/components/league/drive/DriveWorld"), { ssr: false, loading: () => null });

// The towns' own night: their Midnight sky, lights and lit windows.
const { theme: NIGHT, key: NIGHT_KEY, fx: NIGHT_FX } = townTheme(1);
/** The open country: darker than a block's paving, so the cities read as towns. */
const LAND = "#1d2634";
/** A strip of shore along the coast and round the island. */
const COAST = "#3d4659";
/** A block's paving: the towns' ground. */
const PAVING = NIGHT.groundColor;
const LIME = "#c8e64a";

// ─── Ground ──────────────────────────────────────────────────

function shapeOf(ring: Ring): THREE.Shape {
  // Rotated onto the ground (-90° about x): world z is the shape's -y.
  const s = new THREE.Shape();
  ring.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
  return s;
}

/** A flat band of `w` along a closed ring (the beach, a highway). */
function ribbon(points: [number, number][], w: number, closed: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = points.length;
  const at = (i: number) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n; i++) {
    const [px, pz] = at(i - 1);
    const [nx, nz] = at(i + 1);
    let dx = nx - px;
    let dz = nz - pz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const [x, z] = points[i];
    pos.push(x - dz * w * 0.5, 0, z + dx * w * 0.5, x + dz * w * 0.5, 0, z - dx * w * 0.5);
    if (i < n - 1 || closed) {
      const a = i * 2;
      const b = ((i + 1) % n) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Ground({ island }: { island: CityLayout }) {
  const land = useMemo(() => new THREE.ShapeGeometry(OUTLINE.map(shapeOf)), []);
  const beach = useMemo(() => OUTLINE.map((r) => ribbon(r, 160, true)), []);
  const rivers = useMemo(() => RIVERS.map((r) => ribbon(r.points, r.width, false)), []);
  const banks = useMemo(() => RIVERS.map((r) => ribbon(r.points, r.width + 26, false)), []);
  // The sea is the main city's bay as it is; the rivers the same water, lighter.
  const sea = useMemo(() => makeWaterMaterial(), []);
  const water = useMemo(() => {
    const m = makeWaterMaterial();
    m.side = THREE.DoubleSide;
    // Lighter than the bay's: rivers are thin and must read against the land at night
    // (the shader writes its colors as they are, so these come out darker than they read here).
    (m.uniforms.uDeep.value as THREE.Color).set("#3d7fa8");
    (m.uniforms.uShallow.value as THREE.Color).set("#5aa6cf");
    return m;
  }, []);
  useFrame((_, dt) => {
    tickWater(water, dt);
    tickWater(sea, dt);
  });
  const borders = useMemo(() => {
    const pts: number[] = [];
    for (const rings of Object.values(STATE_RINGS)) {
      for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
          const [ax, az] = r[i];
          const [bx, bz] = r[(i + 1) % r.length];
          pts.push(ax, 0, az, bx, 0, bz);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(g, new THREE.LineDashedMaterial({ color: LIME, dashSize: 100, gapSize: 70, transparent: true, opacity: 0.4 })).computeLineDistances();
  }, []);
  useEffect(
    () => () => {
      land.dispose();
      beach.forEach((b) => b.dispose());
      rivers.forEach((r) => r.dispose());
      banks.forEach((r) => r.dispose());
      water.dispose();
      sea.dispose();
      borders.geometry.dispose();
      (borders.material as THREE.Material).dispose();
    },
    [land, beach, borders, rivers, banks, water, sea],
  );
  // The island: a wobbly shore round its blocks, sand outside it.
  const [ix, iz] = lotToWorld(...island.hub);
  const ir = (island.radius + 1.5) * LOT;
  const shore = useMemo(() => {
    const ring: [number, number][] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const k = 1 + 0.09 * Math.sin(3 * a + 1.3) + 0.06 * Math.sin(5 * a + 0.4);
      ring.push([Math.cos(a) * ir * k, Math.sin(a) * ir * k]);
    }
    return ring;
  }, [ir]);
  const isle = useMemo(() => new THREE.ShapeGeometry(shapeOf(shore)), [shore]);
  const sand = useMemo(() => ribbon(shore, 150, true), [shore]);
  useEffect(
    () => () => {
      isle.dispose();
      sand.dispose();
    },
    [isle, sand],
  );
  const cx = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
  const cz = (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2;
  const span = Math.max(MAP_BOUNDS.maxX - MAP_BOUNDS.minX, MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ);
  return (
    <group>
      <mesh position={[cx, -8, cz]} rotation={[-Math.PI / 2, 0, 0]} material={sea}>
        <planeGeometry args={[span * 6, span * 6, 64, 64]} />
      </mesh>
      {beach.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, -4, 0]}>
          <meshStandardMaterial color={COAST} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={land} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <meshStandardMaterial color={LAND} emissive={LAND} emissiveIntensity={0.15} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {banks.map((g, i) => (
        <mesh key={`bank-${i}`} geometry={g} position={[0, -0.7, 0]}>
          <meshStandardMaterial color={COAST} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {rivers.map((g, i) => (
        <mesh key={`river-${i}`} geometry={g} position={[0, -0.4, 0]} material={water} />
      ))}
      <primitive object={borders} position={[0, 0.4, 0]} />
      <group position={[ix, 0, iz]}>
        <mesh geometry={sand} position={[0, -4, 0]}>
          <meshStandardMaterial color={COAST} roughness={1} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={isle} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <meshStandardMaterial color={LAND} emissive={LAND} emissiveIntensity={0.15} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

const _m = new THREE.Matrix4();

/** Every block in use, paved like a town's ground (its lots, inside the streets). */
function Paving({ cities }: { cities: CityLayout[] }) {
  const blocks = useMemo(() => cities.flatMap((c) => c.blocks), [cities]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    blocks.forEach(([x0, z0], i) => {
      const [x, z] = lotToWorld(x0 + 1, z0 + 1);
      _m.makeTranslation(x, 0.05, z);
      ref.current?.setMatrixAt(i, _m);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [blocks]);
  if (blocks.length === 0) return null;
  return (
    <instancedMesh key={blocks.length} ref={ref} args={[undefined, undefined, blocks.length]}>
      <boxGeometry args={[LOT * 3 + 4, 0.1, LOT * 3 + 4]} />
      <meshStandardMaterial color={PAVING} emissive={PAVING} emissiveIntensity={0.15} roughness={0.95} />
    </instancedMesh>
  );
}

function decorationsOf(objects: CityObject[]): CityDecoration[] {
  const out: CityDecoration[] = [];
  for (const o of objects) {
    const [x, z] = o.px !== null && o.pz !== null ? [o.px, o.pz] : lotToWorld(o.x, o.z);
    if (o.item_type === "lamp") out.push({ type: "streetLamp", position: [x, 0, z], rotation: (o.rot * Math.PI) / 180, variant: 0 });
    else if (o.item_type === "fountain") out.push({ type: "fountain", position: [x, 0.6, z], rotation: 0, variant: 0 });
    else if (o.item_type === "bench") out.push({ type: "bench", position: [x, 0, z], rotation: (o.rot * Math.PI) / 180, variant: 0 });
  }
  return out;
}

/** Every city's square: a round plaza round its fountain. */
function Squares({ cities }: { cities: CityLayout[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    cities.forEach((c, i) => {
      const [x, z] = lotToWorld(...c.center);
      _m.makeTranslation(x, 0.3, z);
      ref.current?.setMatrixAt(i, _m);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [cities]);
  return (
    <instancedMesh key={cities.length} ref={ref} args={[undefined, undefined, cities.length]}>
      <cylinderGeometry args={[LOT * 0.62, LOT * 0.62, 0.6, 32]} />
      <meshStandardMaterial color={NIGHT.sidewalkColor} emissive={NIGHT.sidewalkColor} emissiveIntensity={0.2} roughness={0.85} />
    </instancedMesh>
  );
}

/** The city's name on a board by its square (the towns' billboard), lime on the night panel. */
function CitySign({ city }: { city: CityLayout }) {
  const fontReady = useFontReady();
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, 256, 128);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const name = city.name.toUpperCase();
    let px = 34;
    ctx.font = `${px}px Silkscreen, monospace`;
    while (ctx.measureText(name).width > 236 && px > 12) ctx.font = `${(px -= 2)}px Silkscreen, monospace`;
    ctx.fillStyle = "#c8e64a";
    ctx.fillText(name, 128, 54);
    ctx.font = "18px Silkscreen, monospace";
    ctx.fillStyle = "#8a93a6";
    ctx.fillText(city.uf ?? "ISLAND", 128, 96);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    return t;
    // fontReady: redraw once Silkscreen is in.
  }, [city.name, city.uf, fontReady]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  const [x, z] = lotToWorld(...city.center);
  return <Billboard position={[x, z - LOT * 0.42]} rot={0} map={tex} />;
}

/** Up close: the @login over the buildings nearest the middle of the view (the towns' name tags). */
function NearPlates({ buildings }: { buildings: CityBuilding[] }) {
  const [shown, setShown] = useState<CityBuilding[]>([]);
  const last = useRef(0);
  const key = useRef("");
  useFrame(({ camera, controls, clock }) => {
    if (clock.elapsedTime - last.current < 0.4) return;
    last.current = clock.elapsedTime;
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    if (!target) return;
    const far = camera.position.distanceTo(target) > 2200;
    const near = far
      ? []
      : buildings
          .map((b) => ({ b, d: Math.hypot(b.position[0] - target.x, b.position[2] - target.z) }))
          .filter((e) => e.d < 650)
          .sort((p, q) => p.d - q.d)
          .slice(0, 18)
          .map((e) => e.b);
    const k = near.map((b) => b.login).join();
    if (k !== key.current) {
      key.current = k;
      setShown(near);
    }
  });
  return (
    <>
      {shown.map((b) => (
        <Html key={b.login} position={[b.position[0], b.height + 10, b.position[2]]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap border-2 border-border bg-bg/80 px-1.5 py-0.5 font-pixel text-[9px] normal-case text-cream">@{b.login}</div>
        </Html>
      ))}
    </>
  );
}

// ─── Tags ────────────────────────────────────────────────────

function Tag({ city, near, onClick }: { city: CityLayout; near: boolean; onClick: () => void }) {
  const [x, z] = lotToWorld(...city.center);
  const founder = city.devs.find((d) => d.founder)?.dev.login ?? null;
  const st = city.uf ? stateOf(city.uf) : null;
  const swatch = st ? (st.colors[0] === "#ffffff" ? st.colors[1] : st.colors[0]) : LIME;
  return (
    <Html position={[x, 60, z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "auto" }}>
      <button type="button" onClick={onClick} className="flex cursor-pointer flex-col items-center whitespace-nowrap font-pixel uppercase">
        <span className="flex items-center gap-1.5 border-2 border-border bg-bg/85 px-1.5 py-0.5 text-[11px] text-cream hover:border-lime">
          <span className="h-2 w-2" style={{ background: swatch }} aria-hidden />
          {city.second ? city.name : (city.uf ?? "Island")}
          {city.devs.length > 0 && <span className="text-lime">{city.devs.length}</span>}
        </span>
        {near && (
          <span className="border-2 border-t-0 border-border bg-bg/85 px-1.5 py-0.5 text-[8px] normal-case text-muted">
            {founder ? (
              <>
                <span className="uppercase text-lime">founder</span> @{founder}
              </>
            ) : (
              <span className="uppercase">{city.uf ? "no founder yet" : "no state"}</span>
            )}
          </span>
        )}
      </button>
    </Html>
  );
}

// ─── Camera ──────────────────────────────────────────────────

/** Whether the camera is close enough for the tags' details (the founder pill). */
type Near = (near: boolean) => void;

export interface CameraApi {
  /** Fly to a lot, close enough to see its streets (or back to the whole map with null). */
  flyTo: (lot: [number, number] | null, radiusLots?: number) => void;
}

const FOV = 45;

/** The whole country in frame, a little tilted, north up. */
function overviewPose(aspect: number) {
  const cx = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
  const cz = (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2;
  const w = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const d = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
  const half = Math.tan(((FOV / 2) * Math.PI) / 180);
  const dist = (Math.max(w / aspect, d) / (2 * half)) * 1.08;
  const tilt = (72 * Math.PI) / 180;
  return { target: new THREE.Vector3(cx, 0, cz), position: new THREE.Vector3(cx, dist * Math.sin(tilt), cz + dist * Math.cos(tilt)) };
}

function MapCamera({ apiRef, onNear }: { apiRef?: React.MutableRefObject<CameraApi | null>; onNear: Near }) {
  const near = useRef(false);
  const controls = useRef<MapControlsImpl>(null);
  const { size } = useThree();
  const flight = useRef<{ from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | null>(null);
  const placed = useRef(false);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      flyTo: (lot, radiusLots = 12) => {
        const c = controls.current;
        if (!c) return;
        const to = lot
          ? (() => {
              const [x, z] = lotToWorld(...lot);
              const d = Math.max(900, radiusLots * LOT * 2.6);
              return [new THREE.Vector3(x, d * 0.75, z + d * 0.7), new THREE.Vector3(x, 0, z)] as [THREE.Vector3, THREE.Vector3];
            })()
          : (() => {
              const p = overviewPose(size.width / size.height);
              return [p.position, p.target] as [THREE.Vector3, THREE.Vector3];
            })();
        flight.current = { from: [c.object.position.clone(), c.target.clone()], to, t: 0 };
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, size]);

  useFrame(({ camera, scene }, dt) => {
    const c = controls.current;
    if (!c) return;
    if (!placed.current) {
      placed.current = true;
      const p = overviewPose(size.width / size.height);
      camera.position.copy(p.position);
      c.target.copy(p.target);
    }
    const f = flight.current;
    if (f) {
      f.t = Math.min(1, f.t + dt / 1.4);
      const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      camera.position.lerpVectors(f.from[0], f.to[0], k);
      c.target.lerpVectors(f.from[1], f.to[1], k);
      if (f.t >= 1) flight.current = null;
    }
    // Haze scaled to how far up the camera is: the whole country from the top, the streets up close.
    const h = camera.position.distanceTo(c.target);
    const isNear = h < 16000;
    if (isNear !== near.current) {
      near.current = isNear;
      onNear(isNear);
    }
    if (!scene.fog) scene.fog = new THREE.Fog(NIGHT.fogColor, 1, 2);
    const fog = scene.fog as THREE.Fog;
    fog.near = h * 1.6;
    fog.far = h * 5;
    c.update();
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      minDistance={180}
      maxDistance={(MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * 1.6}
      maxPolarAngle={Math.PI / 2.4}
    />
  );
}

// ─── Scene ───────────────────────────────────────────────────

export interface BrasilSceneProps {
  cities: CityLayout[];
  island: CityLayout;
  objects: CityObject[];
  buildings: CityBuilding[];
  cameraApi?: React.MutableRefObject<CameraApi | null>;
  onTag?: (city: CityLayout) => void;
  /** Drive mode: the car and its world (offline in the preview). */
  drive?: Omit<DriveWorldProps, "objects" | "buildings" | "h" | "smash">;
  smash?: SmashStore;
}

export default function BrasilScene({ cities, island, objects, buildings, cameraApi, onTag, drive, smash }: BrasilSceneProps) {
  const driving = !!drive;
  const [near, setNear] = useState(false);
  const decorations = useMemo(() => decorationsOf(objects), [objects]);
  const identity = useMemo(() => ({ sky: 0, signSide: null, logoUrl: null, logoRemoved: false, identityVersion: 0 }), []);
  const cx = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
  const cz = (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2;
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      camera={{ position: [cx, 40000, cz + 15000], fov: FOV, near: 5, far: 400000 }}
      gl={{ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: EXPOSURE }}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
    >
      <ThemeLights theme={NIGHT} themeIndex={NIGHT_KEY} />
      <ThemeSkyFX themeIndex={NIGHT_FX} theme={NIGHT} lowSky />
      {!driving && <MapCamera apiRef={cameraApi} onNear={setNear} />}
      <Ground island={island} />
      <Paving cities={[...cities, island]} />
      <Squares cities={[...cities, island]} />
      {[...cities, island].map((c) => (
        <CitySign key={`sign-${c.uf ?? "island"}-${c.second ? 2 : 1}`} city={c} />
      ))}
      <InstancedDecorations items={decorations} roadMarkingColor={NIGHT.roadMarkingColor} sidewalkColor={NIGHT.sidewalkColor} />
      <LeagueRoads objects={objects} markingColor={NIGHT.roadMarkingColor} />
      <Suspense fallback={null}>
        <LeagueTrees objects={objects} />
      </Suspense>
      <IdentityLayer objects={objects} identity={identity} name="Brasil" h={MAP_H} hillColor={LAND} />
      <CityScene buildings={buildings} colors={NIGHT.building} accentColor={NIGHT.building.accent} smash={smash} />
      {!driving && <NearPlates buildings={buildings} />}
      {!driving && [...cities, island].map((c) => <Tag key={`${c.uf ?? "island"}-${c.second ? 2 : 1}`} city={c} near={near} onClick={() => onTag?.(c)} />)}
      {driving && drive && <DriveWorld objects={objects} buildings={buildings} h={MAP_H} smash={smash} {...drive} />}
    </Canvas>
  );
}

export type { UF };
