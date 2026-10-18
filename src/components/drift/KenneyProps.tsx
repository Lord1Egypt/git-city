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
// cost what one does. Positions are meters, like the track. `night` repaints
// them by material for a town at night, whose light is made for near-black
// buildings: the kits' whites and pastels would glare there.

const U = M_TO_UNIT;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

/** The kits' materials at night, as deep as a town's buildings (a face there is #12221a); textured ones darken their texture. */
const NIGHT: Record<string, string> = {
  grey: "#1c2b24",
  _defaultMat: "#1c2b24",
  road: "#0e1114",
  red: "#5c1418",
  glass: "#16263a",
  grass: "#123a2c",
  leafsDark: "#0f2e2a",
  leafsGreen: "#123a2c",
  woodBark: "#3a2216",
  woodBarkDark: "#2e1b12",
  woodDark: "#2e1b12",
  dirt: "#3a2216",
  bark: "#3a2a18",
  wood: "#3a2216",
  woodInner: "#4a3a2a",
  pylon: "#6a5010",
  stone: "#2a3a3a",
};
const NIGHT_TEXTURED = "#5a5a5a";

function nightCopy(m: THREE.Material): THREE.Material {
  const c = m.clone() as THREE.MeshStandardMaterial;
  if (c.color) c.color.set(NIGHT[m.name] ?? (c.map ? NIGHT_TEXTURED : "#1c2b24"));
  return c;
}

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  /** The part inside the fitted model: normalizing scale, centering and its own node transform. */
  local: THREE.Matrix4;
}

/** A model's meshes, fitted to its size and set on its footprint's center. */
function useParts(kind: PropKind, night: boolean): Part[] {
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
    const fit = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
    const parts: Part[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = night ? (Array.isArray(mesh.material) ? mesh.material.map(nightCopy) : nightCopy(mesh.material)) : mesh.material;
      parts.push({ geometry: mesh.geometry, material, local: fit.clone().multiply(mesh.matrixWorld) });
    });
    return parts;
  }, [gltf, def, night]);
  // The night copies are this model's own; the kits' materials stay shared.
  useEffect(
    () => () => {
      if (night) for (const p of parts) (Array.isArray(p.material) ? p.material : [p.material]).forEach((m) => m.dispose());
    },
    [parts, night],
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
  return <instancedMesh key={items.length} ref={ref} args={[part.geometry, part.material, items.length]} castShadow={false} receiveShadow={false} />;
}

function Kind({ kind, items, night }: { kind: PropKind; items: PropItem[]; night: boolean }) {
  const parts = useParts(kind, night);
  return (
    <>
      {parts.map((p, i) => (
        <PartMesh key={i} part={p} items={items} />
      ))}
    </>
  );
}

export default function KenneyProps({ items, night = false }: { items: PropItem[]; night?: boolean }) {
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
        <Kind key={kind} kind={kind} items={list} night={night} />
      ))}
    </>
  );
}
