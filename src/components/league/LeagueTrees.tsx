"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { mergeBufferGeometries } from "three-stdlib";
import * as THREE from "three";
import { lotToWorld, rotToRadians } from "@/lib/league-city/grid";
import { TREE_TYPES, type CityObject, type TreeType } from "@/lib/league-city/types";
import { createCullState, cullInstances } from "@/lib/instance-cull";

// The 6 Kenney Nature Kit trees (CC0), loaded once and instanced per type.
// useGLTF caches per URL; each tree keeps its leaf and bark materials as
// separate submeshes. A big map (the Brasil town) passes `cull`: only the
// trees near the camera or in view are drawn, as in the main city.

const TREE_URL: Record<TreeType, string> = {
  tree_default: "/models/trees/tree_default.glb",
  tree_oak: "/models/trees/tree_oak.glb",
  tree_fat: "/models/trees/tree_fat.glb",
  tree_detailed: "/models/trees/tree_detailed.glb",
  tree_palm_tall: "/models/trees/tree_palmTall.glb",
  tree_pine_tall_a: "/models/trees/tree_pineTallA.glb",
};
const URLS = TREE_TYPES.map((t) => TREE_URL[t]);
useGLTF.preload(URLS);

const TREE_H = 30;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

type Variant = { subs: { geo: THREE.BufferGeometry; mat: THREE.Material }[]; scale: number };

type TreeSpot = { wx: number; wz: number; rot: number };

/** Where to cut trees off on a culled map. */
export interface TreeCull {
  /** Past this distance from the camera no tree is drawn (the whole country from above: none). */
  maxDistance: number;
}

function matrixOf(l: TreeSpot, variant: Variant) {
  const jitter = 0.85 + (Math.abs(Math.round(l.wx * 31 + l.wz * 17) % 7) / 7) * 0.3;
  _q.setFromAxisAngle(_up, rotToRadians(l.rot));
  _p.set(l.wx, 0, l.wz);
  _s.setScalar(variant.scale * jitter);
  return _m.compose(_p, _q, _s);
}

/** A map's worth of one tree: every matrix kept aside, the meshes holding only what the camera sees. */
function CulledTreeInstances({ variant, lots, cull }: { variant: Variant; lots: TreeSpot[]; cull: TreeCull }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const state = useRef(createCullState());
  const data = useMemo(() => {
    const src = new Float32Array(lots.length * 16);
    const pos = new Float32Array(lots.length * 2);
    lots.forEach((l, i) => {
      matrixOf(l, variant).toArray(src, i * 16);
      pos[i * 2] = l.wx;
      pos[i * 2 + 1] = l.wz;
    });
    return { src, pos };
  }, [lots, variant]);
  useLayoutEffect(() => {
    state.current.dirty = true;
  }, [data]);
  useFrame(({ camera, scene, clock }) => {
    const meshes = refs.current.filter((m): m is THREE.InstancedMesh => !!m);
    cullInstances(state.current, camera, scene, clock.elapsedTime, [{ ...data, meshes }], { maxDistance: cull.maxDistance });
  });
  return (
    <>
      {variant.subs.map((sub, i) => (
        <instancedMesh
          key={`${i}-${lots.length}`}
          ref={(el) => {
            refs.current[i] = el;
            if (el) state.current.dirty = true;
          }}
          args={[sub.geo, sub.mat, lots.length]}
          count={0}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

function TreeInstances({ variant, lots }: { variant: Variant; lots: TreeSpot[] }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    lots.forEach((l, i) => {
      const m = matrixOf(l, variant);
      for (const r of refs.current) r?.setMatrixAt(i, m);
    });
    for (const r of refs.current) {
      if (!r) continue;
      r.instanceMatrix.needsUpdate = true;
      r.computeBoundingSphere();
    }
  }, [lots, variant]);
  return (
    <>
      {variant.subs.map((sub, i) => (
        <instancedMesh
          key={`${i}-${lots.length}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          args={[sub.geo, sub.mat, lots.length]}
        />
      ))}
    </>
  );
}

export default function LeagueTrees({ objects, cull }: { objects: CityObject[]; cull?: TreeCull }) {
  const gltfs = useGLTF(URLS) as unknown as { scene: THREE.Group }[];
  const variants = useMemo<Variant[]>(
    () =>
      gltfs.map((g) => {
        g.scene.updateMatrixWorld(true);
        const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
        let minY = Infinity;
        let maxY = -Infinity;
        g.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const ge = mesh.geometry.clone();
          ge.applyMatrix4(mesh.matrixWorld);
          ge.computeBoundingBox();
          minY = Math.min(minY, ge.boundingBox!.min.y);
          maxY = Math.max(maxY, ge.boundingBox!.max.y);
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
          (groups.get(mat) ?? groups.set(mat, []).get(mat)!).push(ge);
        });
        const subs = [...groups.entries()].map(([mat, geos]) => {
          const geo = geos.length === 1 ? geos[0] : (mergeBufferGeometries(geos, false) ?? geos[0]);
          geo.translate(0, -minY, 0);
          return { geo, mat };
        });
        return { subs, scale: TREE_H / (maxY - minY || 1) };
      }),
    [gltfs],
  );
  useLayoutEffect(() => () => variants.forEach((v) => v.subs.forEach((s) => s.geo.dispose())), [variants]);

  const lotsByType = useMemo(() => {
    const out = TREE_TYPES.map(() => [] as TreeSpot[]);
    for (const o of objects) {
      const i = TREE_TYPES.indexOf(o.item_type as TreeType);
      if (i < 0) continue;
      const [wx, wz] = o.px !== null && o.pz !== null ? [o.px, o.pz] : lotToWorld(o.x, o.z);
      out[i].push({ wx, wz, rot: o.rot });
    }
    return out;
  }, [objects]);

  return (
    <group>
      {variants.map((v, i) =>
        lotsByType[i].length === 0 ? null : cull ? (
          <CulledTreeInstances key={i} variant={v} lots={lotsByType[i]} cull={cull} />
        ) : (
          <TreeInstances key={i} variant={v} lots={lotsByType[i]} />
        ),
      )}
    </group>
  );
}
