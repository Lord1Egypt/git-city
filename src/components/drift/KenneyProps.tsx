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
// cost what one does. Positions are meters, like the track. `tone` darkens
// their colors for a scene lit hotter than the drift spots' afternoon (a
// town's night, drawn at a higher exposure).

const U = M_TO_UNIT;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  /** The part inside the fitted model: normalizing scale, centering and its own node transform. */
  local: THREE.Matrix4;
}

/** A model's meshes, fitted to its size and set on its footprint's center. */
function useParts(kind: PropKind): Part[] {
  const def = MODELS[kind];
  const gltf = useGLTF(def.url);
  return useMemo(() => {
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
      parts.push({ geometry: mesh.geometry, material: mesh.material, local: fit.clone().multiply(mesh.matrixWorld) });
    });
    return parts;
  }, [gltf, def]);
}

/** The part's material, its colors scaled by `tone` (a copy, so other scenes keep theirs). */
function useToned(material: Part["material"], tone: number): Part["material"] {
  const toned = useMemo(() => {
    if (tone === 1) return null;
    const one = (m: THREE.Material) => {
      const c = m.clone();
      (c as THREE.MeshStandardMaterial).color?.multiplyScalar(tone);
      return c;
    };
    return Array.isArray(material) ? material.map(one) : one(material);
  }, [material, tone]);
  useEffect(
    () => () => {
      if (toned) (Array.isArray(toned) ? toned : [toned]).forEach((m) => m.dispose());
    },
    [toned],
  );
  return toned ?? material;
}

function PartMesh({ part, items, tone }: { part: Part; items: PropItem[]; tone: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useToned(part.material, tone);
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
  return <instancedMesh key={items.length} ref={ref} args={[part.geometry, material, items.length]} castShadow={false} receiveShadow={false} />;
}

function Kind({ kind, items, tone }: { kind: PropKind; items: PropItem[]; tone: number }) {
  const parts = useParts(kind);
  return (
    <>
      {parts.map((p, i) => (
        <PartMesh key={i} part={p} items={items} tone={tone} />
      ))}
    </>
  );
}

export default function KenneyProps({ items, tone = 1 }: { items: PropItem[]; tone?: number }) {
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
        <Kind key={kind} kind={kind} items={list} tone={tone} />
      ))}
    </>
  );
}
