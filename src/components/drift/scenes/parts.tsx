"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InstancedDecorations } from "@/components/city/decorations";
import type { CityDecoration } from "@/lib/github";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import { curbRuns, offsetAt, wallSegments } from "@/lib/league-city/race/layout";
import { wallOffset, type Track } from "@/lib/league-city/race/track";
import type { Clip } from "@/lib/drift/score";

// The pieces every drift spot is built from, in Git City's look: flat colors
// that light themselves (emissive, like the city's buildings and lamps), the
// city's street lamps, road markings in its marking color. Meters in, city
// units out (1 m = M_TO_UNIT).

export const U = M_TO_UNIT;

export function useDispose<T extends { dispose: () => void }>(v: T): T {
  useEffect(() => () => v.dispose(), [v]);
  return v;
}

/** Flat, self-lit material: the city's way of reading at night without real lights. */
export function flat(color: string, glow = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: 1, metalness: 0 });
}

/** A flat band from `a` to `b` m left of the centerline over [s0, s1], facing up. */
export function ribbon(t: Track, s0: number, s1: number, a: number, b: number, y: number, step = 2): THREE.BufferGeometry {
  const pos: number[] = [];
  const n = Math.max(1, Math.round((s1 - s0) / step));
  for (let i = 0; i < n; i++) {
    const sa = s0 + ((s1 - s0) * i) / n;
    const sb = s0 + ((s1 - s0) * (i + 1)) / n;
    const pa = offsetAt(t, sa, a);
    const pb = offsetAt(t, sa, b);
    const qa = offsetAt(t, sb, a);
    const qb = offsetAt(t, sb, b);
    for (const p of [pa, pb, qb, pa, qb, qa]) pos.push(p.x * U, y, p.z * U);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return g;
}

/** The inside of a loop as one flat shape (the yard a closed track encloses). */
export function loopFill(t: Track, y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(t.samples.map((p) => new THREE.Vector2(p.x * U, p.z * U)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function Mesh({ geo, mat }: { geo: THREE.BufferGeometry; mat: THREE.Material }) {
  useDispose(geo);
  useDispose(mat);
  return <mesh geometry={geo} material={mat} />;
}

export interface RoadLook {
  asphalt: string;
  line: string;
  /** Corner curbs, two alternating colors. */
  curb: [string, string];
}

/** Asphalt, white edge lines, a dashed center line and striped curbs in the corners. */
export function Road({ track, look }: { track: Track; look: RoadLook }) {
  const w = track.spec.width / 2;
  const asphalt = useMemo(() => ribbon(track, 0, track.length, w, -w, 0.06), [track, w]);
  const edges = useMemo(() => {
    const a = ribbon(track, 0, track.length, w - 0.25, w - 0.55, 0.1);
    const b = ribbon(track, 0, track.length, -w + 0.55, -w + 0.25, 0.1);
    return mergeFlat([a, b]);
  }, [track, w]);
  const dashes = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let s = 2; s < track.length - 3; s += 9) parts.push(ribbon(track, s, s + 4, 0.18, -0.18, 0.1, 4));
    return mergeFlat(parts);
  }, [track]);
  const curbs = useMemo(() => {
    const out: THREE.BufferGeometry[][] = [[], []];
    for (const [s0, s1] of curbRuns(track)) {
      for (let s = Math.max(0, s0); s < Math.min(track.length, s1); s += 2) {
        const k = Math.floor(s / 2) % 2;
        out[k].push(ribbon(track, s, s + 2, w + track.spec.curb, w, 0.08, 2));
        out[k].push(ribbon(track, s, s + 2, -w, -w - track.spec.curb, 0.08, 2));
      }
    }
    return out.map((g) => mergeFlat(g));
  }, [track, w]);
  return (
    <group>
      <Mesh geo={asphalt} mat={useMemo(() => flat(look.asphalt, 0.25), [look.asphalt])} />
      <Mesh geo={edges} mat={useMemo(() => flat(look.line, 0.9), [look.line])} />
      <Mesh geo={dashes} mat={useMemo(() => flat(look.line, 0.6), [look.line])} />
      <Mesh geo={curbs[0]} mat={useMemo(() => flat(look.curb[0], 0.6), [look.curb])} />
      <Mesh geo={curbs[1]} mat={useMemo(() => flat(look.curb[1], 0.4), [look.curb])} />
    </group>
  );
}

/** Striped paint where a clipping point is: the zone to hit, in hazard stripes. */
export function ClipMarks({ track, clips, colors }: { track: Track; clips: readonly Clip[]; colors: [string, string] }) {
  const geos = useMemo(() => {
    const out: THREE.BufferGeometry[][] = [[], []];
    const w = track.spec.width / 2;
    const face = wallOffset(track.spec) - track.spec.wallThickness / 2;
    for (const c of clips) {
      const edge = c.kind === "inner" ? w : face;
      for (let s = c.s; s < c.s + c.len; s += 1.5) {
        const k = Math.floor(s / 1.5) % 2;
        out[k].push(ribbon(track, s, s + 1.5, c.side * edge, c.side * (edge - c.depth), 0.12, 1.5));
      }
    }
    return out.map((g) => mergeFlat(g));
  }, [track, clips]);
  return (
    <group>
      <Mesh geo={geos[0]} mat={useMemo(() => flat(colors[0], 0.9), [colors])} />
      <Mesh geo={geos[1]} mat={useMemo(() => flat(colors[1], 0.3), [colors])} />
    </group>
  );
}

/** Merge flat geometries (position and normal only) into one. */
export function mergeFlat(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const p of parts) n += p.getAttribute("position").count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.getAttribute("position").array as Float32Array, o * 3);
    nrm.set(p.getAttribute("normal").array as Float32Array, o * 3);
    o += p.getAttribute("position").count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return g;
}

export interface Box {
  x: number;
  y: number;
  z: number;
  /** Size (city units). */
  w: number;
  h: number;
  d: number;
  rotY: number;
  color: string;
}

/** Many boxes, one draw call per material: containers, barriers, crane parts. */
export function Boxes({ boxes, glow = 0.35 }: { boxes: Box[]; glow?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useDispose(useMemo(() => new THREE.BoxGeometry(1, 1, 1), []));
  const mat = useDispose(useMemo(() => {
    const m = flat("#ffffff", glow);
    m.emissive.set("#000000");
    // Instance colors light themselves like the city: emissive follows the instance color.
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(2)};`,
      );
    };
    return m;
  }, [glow]));
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    boxes.forEach((b, i) => {
      o.position.set(b.x, b.y + b.h / 2, b.z);
      o.rotation.set(0, b.rotY, 0);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(b.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [boxes]);
  if (boxes.length === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, boxes.length]} frustumCulled={false} />;
}

/** Low concrete barriers along both walls (the colliders' look). */
export function Barriers({ track, color, height = 1.1 }: { track: Track; color: string; height?: number }) {
  const boxes = useMemo<Box[]>(
    () =>
      wallSegments(track).map((w) => ({
        x: w.x * U,
        y: 0,
        z: w.z * U,
        w: track.spec.wallThickness * U,
        h: height * U,
        d: w.len * U,
        rotY: w.rotY,
        color: w.i % 2 === 0 ? color : shade(color, 0.85),
      })),
    [track, color, height],
  );
  return <Boxes boxes={boxes} glow={0.18} />;
}

export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** The city's street lamps along the track, with a pool of light under each. */
export function Lamps({ track, every = 34, color = "#f0d870", marking }: { track: Track; every?: number; color?: string; marking: string }) {
  const off = wallOffset(track.spec) + 2;
  const items = useMemo<CityDecoration[]>(() => {
    const out: CityDecoration[] = [];
    let i = 0;
    for (let s = 6; s < track.length - 4; s += every, i++) {
      const p = offsetAt(track, s, (i % 2 ? 1 : -1) * off);
      out.push({ type: "streetLamp", position: [p.x * U, 0, p.z * U], rotation: 0, variant: 0 });
    }
    return out;
  }, [track, every, off]);
  return (
    <>
      <InstancedDecorations items={items} roadMarkingColor={marking} sidewalkColor={marking} />
      <LightPools spots={items.map((d) => [d.position[0], d.position[2]])} color={color} radius={9 * U} />
    </>
  );
}

let poolTex: THREE.Texture | null = null;
function poolTexture(): THREE.Texture {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,0.55)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.18)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}

/** Soft warm circles on the ground: the light a lamp throws, without a real light. */
export function LightPools({ spots, color, radius }: { spots: [number, number][]; color: string; radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useDispose(useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []));
  const mat = useDispose(
    useMemo(
      () => new THREE.MeshBasicMaterial({ map: poolTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      [color],
    ),
  );
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0.3, z);
      o.scale.set(radius * 2, 1, radius * 2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots, radius]);
  if (spots.length === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, spots.length]} frustumCulled={false} renderOrder={1} />;
}

/** A banner texture in the city's pixel font. */
export function signTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  let size = 58;
  do {
    g.font = `${size}px Silkscreen, monospace`;
    size -= 2;
  } while (size > 16 && g.measureText(text).width > c.width - 40);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text.toUpperCase(), c.width / 2, c.height / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** The start (and a run's finish): a checkered line and a gantry with the spot's name. */
export function StartGantry({ track, s = 0, name, accent }: { track: Track; s?: number; name: string; accent: string }) {
  const p = offsetAt(track, s, 0);
  const rot = Math.atan2(p.tx, p.tz);
  const span = wallOffset(track.spec) + 0.5;
  const tex = useDispose(useMemo(() => signTexture(name, accent, "#0d1016"), [name, accent]));
  const checks = useMemo(() => {
    const out: Box[] = [];
    const cells = 10;
    const size = track.spec.width / cells;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cells; c++) {
        const q = offsetAt(track, s + (r - 0.5) * size, -track.spec.width / 2 + size * (c + 0.5));
        out.push({ x: q.x * U, y: 0.05, z: q.z * U, w: size * U, h: 0.1, d: size * U, rotY: rot, color: (r + c) % 2 ? "#f2f2f2" : "#15181f" });
      }
    }
    return out;
  }, [track, s, rot]);
  const posts = useMemo<Box[]>(() => {
    const out: Box[] = [];
    for (const side of [1, -1]) {
      const q = offsetAt(track, s, side * span);
      out.push({ x: q.x * U, y: 0, z: q.z * U, w: 1 * U, h: 8 * U, d: 1 * U, rotY: rot, color: "#3a4150" });
    }
    return out;
  }, [track, s, span, rot]);
  return (
    <group>
      <Boxes boxes={checks} glow={0.5} />
      <Boxes boxes={posts} glow={0.3} />
      <mesh position={[p.x * U, 8 * U, p.z * U]} rotation={[0, rot, 0]}>
        <boxGeometry args={[span * 2 * U + 2 * U, 2.4 * U, 0.8 * U]} />
        <meshStandardMaterial color="#1d222c" emissive="#1d222c" emissiveIntensity={0.3} />
      </mesh>
      {[1, -1].map((f) => (
        <mesh key={f} position={[p.x * U - p.tx * f * 0.42 * U, 8 * U, p.z * U - p.tz * f * 0.42 * U]} rotation={[0, rot + (f > 0 ? Math.PI : 0), 0]} renderOrder={2}>
          <planeGeometry args={[Math.min(span * 2, 22) * U, 2 * U]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** A red light that blinks (aviation lights on cranes and masts). */
export function Blinker({ position, period = 1.6, phase = 0 }: { position: [number, number, number]; period?: number; phase?: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const on = ((clock.elapsedTime + phase) % period) / period < 0.5;
    m.color.set(on ? "#ff3b30" : "#3a0d0b");
  });
  return (
    <mesh position={position}>
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshBasicMaterial ref={ref} color="#ff3b30" toneMapped={false} />
    </mesh>
  );
}
