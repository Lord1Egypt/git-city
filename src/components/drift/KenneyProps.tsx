"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import { MODELS, type PropItem, type PropKind } from "@/lib/drift/props";

// Kenney models (CC0) around a drift spot: the Racing Kit's grandstands,
// pits, tents, light posts, banner towers and flags, the Nature Kit's trees,
// rocks and logs, the City Kit Industrial's containers and tanks. Each model
// is fitted to a size in meters (the kits use different scales), centered on
// its footprint, and drawn as one instanced mesh per part, so a hundred trees
// cost what one does. Positions are meters, like the track. `paint`
// repaints them by material (a town at night, whose light is made for
// near-black buildings: the kits' whites and pastels would glare there).

const U = M_TO_UNIT;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

/** Colors by the kits' material names; `textured` tints the textured ones, `other` takes any name not listed. */
export interface KenneyPaint {
  colors: Record<string, string>;
  textured: string;
  other: string;
}

/** The kits' materials at night: mid tones that a town's hot light lifts to readable, accents kept saturated; textured ones dim their texture. */
export const NIGHT_PAINT: KenneyPaint = {
  colors: {
    grey: "#56665e",
    _defaultMat: "#56665e",
    road: "#1e242c",
    red: "#a3262e",
    glass: "#2a4058",
    grass: "#1f5e46",
    leafsDark: "#1a4e48",
    leafsGreen: "#1f5e46",
    woodBark: "#6a4028",
    woodBarkDark: "#5a3420",
    woodDark: "#5a3420",
    dirt: "#6a4028",
    bark: "#6a5030",
    wood: "#6a4028",
    woodInner: "#7a6450",
    pylon: "#b08a1a",
    stone: "#4a5e5e",
  },
  textured: "#9a9a9a",
  other: "#56665e",
};

function paintCopy(m: THREE.Material, paint: KenneyPaint): THREE.Material {
  const c = m.clone() as THREE.MeshStandardMaterial;
  if (c.color) c.color.set(paint.colors[m.name] ?? (c.map ? paint.textured : paint.other));
  return c;
}

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  /** The part inside the fitted model: normalizing scale, centering and its own node transform. */
  local: THREE.Matrix4;
}

/** A model's meshes, fitted to its size and set on its footprint's center. */
function useParts(kind: PropKind, paint: KenneyPaint | null): Part[] {
  const def = MODELS[kind];
  const gltf = useGLTF(def.url);
  const parts = useMemo(() => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const along = def.axis === "x" ? size.x : def.axis === "y" ? size.y : size.z;
    const k = (def.size * U) / Math.max(1e-6, along);
    const center = box.getCenter(new THREE.Vector3());
    const fit = new THREE.Matrix4()
      .makeScale(k, k, k)
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
    const parts: Part[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const one = (m: THREE.Material) => (paint ? paintCopy(m, paint) : m);
      const material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
      parts.push({
        geometry: mesh.geometry,
        material,
        local: fit.clone().multiply(mesh.matrixWorld),
      });
    });
    return parts;
  }, [gltf, def, paint]);
  // The painted copies are this model's own; the kits' materials stay shared.
  useEffect(
    () => () => {
      if (paint)
        for (const p of parts)
          (Array.isArray(p.material) ? p.material : [p.material]).forEach((m) => m.dispose());
    },
    [parts, paint],
  );
  return parts;
}

function PartMesh({ part, items }: { part: Part; items: PropItem[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((it, i) => {
      _q.setFromAxisAngle(_y, it.rotY);
      _p.set(it.x * U, (it.y ?? 0) * U, it.z * U);
      const k = it.scale ?? 1;
      _s.set(k, k, k);
      _m.compose(_p, _q, _s).multiply(part.local);
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, part]);
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[part.geometry, part.material, items.length]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

function Kind({
  kind,
  items,
  paint,
}: {
  kind: PropKind;
  items: PropItem[];
  paint: KenneyPaint | null;
}) {
  const parts = useParts(kind, paint);
  return (
    <>
      {parts.map((p, i) => (
        <PartMesh key={i} part={p} items={items} />
      ))}
    </>
  );
}

export default function KenneyProps({
  items,
  paint = null,
}: {
  items: PropItem[];
  paint?: KenneyPaint | null;
}) {
  const byKind = useMemo(() => {
    const map = new Map<PropKind, PropItem[]>();
    for (const it of items) {
      const list = map.get(it.kind);
      if (list) list.push(it);
      else map.set(it.kind, [it]);
    }
    return [...map.entries()];
  }, [items]);
  return (
    <>
      {byKind.map(([kind, list]) => (
        <Kind key={kind} kind={kind} items={list} paint={paint} />
      ))}
    </>
  );
}
