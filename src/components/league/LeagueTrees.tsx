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
  /**
   * Driving through trees: where the car is (world units), or null. A tree the
   * car reaches falls away from it and stands back up after a while; with this
   * set the trees are left out of the car's colliders (the caller's job).
   */
  knock?: () => { x: number; z: number } | null;
}

/** How close the car's middle gets to a trunk to knock it (units: half the car plus the trunk). */
const KNOCK_REACH = 5.5;
/** Falling, lying down, standing back up (seconds). */
const FALL_S = 0.45;
const DOWN_S = 20;
const RISE_S = 1.2;
const KNOCK_CELL = 64;
const _qTilt = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _rot = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _out = new THREE.Matrix4();

/** How far over a knocked tree leans (0 standing, 1 flat), `t` seconds after the hit. */
function lean(t: number): number {
  if (t < FALL_S) return (t / FALL_S) ** 2;
  if (t < FALL_S + DOWN_S) return 1;
  const k = (t - FALL_S - DOWN_S) / RISE_S;
  return k >= 1 ? 0 : 1 - k * k;
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
  // Knocked trees: when each was hit and which way it falls; the trunks near the car found through a grid.
  const knocked = useRef(new Map<number, { at: number; dx: number; dz: number }>());
  const grid = useMemo(() => {
    if (!cull.knock) return null;
    const g = new Map<string, number[]>();
    lots.forEach((l, i) => {
      const k = `${Math.floor(l.wx / KNOCK_CELL)},${Math.floor(l.wz / KNOCK_CELL)}`;
      (g.get(k) ?? g.set(k, []).get(k)!).push(i);
    });
    return g;
  }, [lots, cull.knock]);
  useFrame(({ camera, scene, clock }) => {
    const meshes = refs.current.filter((m): m is THREE.InstancedMesh => !!m);
    const t = clock.elapsedTime;
    const car = cull.knock?.();
    if (car && grid) {
      const cx = Math.floor(car.x / KNOCK_CELL);
      const cz = Math.floor(car.z / KNOCK_CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gz = cz - 1; gz <= cz + 1; gz++)
          for (const i of grid.get(`${gx},${gz}`) ?? []) {
            const dx = lots[i].wx - car.x;
            const dz = lots[i].wz - car.z;
            const d = Math.hypot(dx, dz);
            if (d > KNOCK_REACH || knocked.current.has(i)) continue;
            knocked.current.set(i, { at: t, dx: dx / (d || 1), dz: dz / (d || 1) });
          }
    }
    // A tree on its way down or back up moves every frame: the meshes are repacked while any does.
    const moving = [...knocked.current.values()].some((k) => t - k.at < FALL_S + 0.1 || t - k.at > FALL_S + DOWN_S - 0.1);
    for (const [i, k] of knocked.current) if (t - k.at > FALL_S + DOWN_S + RISE_S) knocked.current.delete(i);
    if (moving) state.current.dirty = true;
    const src = knocked.current.size ? leaned(data.src, knocked.current, t) : data.src;
    cullInstances(state.current, camera, scene, t, [{ src, pos: data.pos, meshes }], { maxDistance: cull.maxDistance });
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

/** The matrices with each knocked tree leaned over, falling away from the car (a copy: the source stays upright). */
function leaned(src: Float32Array, knocked: Map<number, { at: number; dx: number; dz: number }>, t: number): Float32Array {
  const out = src.slice();
  for (const [i, k] of knocked) {
    const a = lean(t - k.at) * (Math.PI / 2) * 0.95;
    if (a <= 0) continue;
    _out.fromArray(src, i * 16).decompose(_pos, _rot, _scl);
    // Tip over round the horizontal axis square to the push, at the trunk's base.
    _axis.set(k.dz, 0, -k.dx).normalize();
    _qTilt.setFromAxisAngle(_axis, a);
    _out.compose(_pos, _qTilt.multiply(_rot), _scl).toArray(out, i * 16);
  }
  return out;
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
