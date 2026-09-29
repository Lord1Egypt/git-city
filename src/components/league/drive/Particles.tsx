"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FxSources } from "./fx";
import { COUGHS } from "@/lib/league-city/drive/guest-gate";

// Fixed particle pools: tire smoke while the rear slips, and a boost trail
// from the exhaust while boosting. No allocation per frame.

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);

function makePool(count: number): Particle[] {
  return Array.from({ length: count }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 1, life: 1, size: 1 }));
}

function draw(mesh: THREE.InstancedMesh, pool: Particle[], grow: boolean) {
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (p.age >= p.life) {
      mesh.setMatrixAt(i, _hidden);
      continue;
    }
    const t = p.age / p.life;
    const size = grow ? p.size * (0.6 + t * 1.8) * (1 - t * t) : p.size * (1 - t);
    _s.setScalar(Math.max(0.001, size));
    mesh.setMatrixAt(i, _m.compose(p.pos, _q, _s));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function Smoke({ sources }: { sources: FxSources }) {
  const COUNT = 128;
  const poolRef = useRef<Particle[] | null>(null);
  const ref = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0);
  const acc = useRef(new Map<string, number>());
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    poolRef.current ??= makePool(COUNT);
    const pool = poolRef.current;
    for (const [key, c] of sources.current) {
      if (c.slip <= 0.2 || !c.grounded) continue;
      let a = (acc.current.get(key) ?? 0) + dt * 18 * c.slip;
      while (a >= 1) {
        a -= 1;
        const w = c.rearWheels[next.current % 2];
        if (!w) break;
        w.getWorldPosition(_p);
        const p = pool[next.current];
        p.pos.copy(_p);
        p.pos.y = 0.8;
        p.vel.set((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3);
        p.age = 0;
        p.life = 0.9 + Math.random() * 0.5;
        p.size = 0.6 + Math.random() * 0.4;
        next.current = (next.current + 1) % COUNT;
      }
      acc.current.set(key, a);
    }
    for (const p of pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 1.5);
    }
    draw(mesh, pool, true);
  });

  return (
    <instancedMesh ref={ref} args={[geo, undefined, COUNT]} frustumCulled={false}>
      <meshStandardMaterial color="#c8c8d0" emissive="#50505a" transparent opacity={0.28} depthWrite={false} roughness={1} />
    </instancedMesh>
  );
}

export function BoostTrail({ sources }: { sources: FxSources }) {
  const COUNT = 96;
  const poolRef = useRef<Particle[] | null>(null);
  const ref = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0);
  const acc = useRef(new Map<string, number>());
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    poolRef.current ??= makePool(COUNT);
    const pool = poolRef.current;
    for (const [key, c] of sources.current) {
      if (!c.boosting) continue;
      let a = (acc.current.get(key) ?? 0) + dt * 60;
      while (a >= 1) {
        a -= 1;
        // Exhaust: behind the rear bumper, low.
        _p.set((Math.random() - 0.5) * 1.5, 1.4, -4.6);
        c.group.localToWorld(_p);
        const p = pool[next.current];
        p.pos.copy(_p);
        p.vel.set((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2);
        p.age = 0;
        p.life = 0.35 + Math.random() * 0.2;
        p.size = 0.9 + Math.random() * 0.6;
        next.current = (next.current + 1) % COUNT;
      }
      acc.current.set(key, a);
    }
    for (const p of pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.pos.addScaledVector(p.vel, dt);
    }
    draw(mesh, pool, false);
  });

  return (
    <instancedMesh ref={ref} args={[geo, undefined, COUNT]} frustumCulled={false}>
      <meshBasicMaterial color="#7ee8ff" toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
  );
}


/**
 * A guest's car running out of gas (lib drive/guest-gate): dark smoke from
 * the hood, a thick puff and a thud (the impact sound and camera kick) on
 * every cough, a thin trail in between.
 */
export function EngineSmoke({
  car,
  stallAt,
  impact,
}: {
  car: React.MutableRefObject<{ group: THREE.Object3D } | null>;
  stallAt: React.MutableRefObject<number | null>;
  impact: React.MutableRefObject<{ strength: number; at: number }>;
}) {
  const COUNT = 96;
  const poolRef = useRef<Particle[] | null>(null);
  const ref = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0);
  const acc = useRef(0);
  const coughed = useRef(0);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    poolRef.current ??= makePool(COUNT);
    const pool = poolRef.current;
    const at = stallAt.current;
    const c = car.current;
    const puff = (n: number, big: boolean) => {
      for (let i = 0; i < n && c; i++) {
        // Out of the hood: front of the car, just above it.
        _p.set((Math.random() - 0.5) * 2, 2.4, 2.6 + Math.random() * 1.2);
        c.group.localToWorld(_p);
        const p = pool[next.current];
        p.pos.copy(_p);
        p.vel.set((Math.random() - 0.5) * (big ? 4 : 1.5), (big ? 3 : 2) + Math.random() * 2, (Math.random() - 0.5) * (big ? 4 : 1.5));
        p.age = 0;
        p.life = (big ? 1.4 : 1) + Math.random() * 0.6;
        p.size = (big ? 1.1 : 0.6) + Math.random() * 0.5;
        next.current = (next.current + 1) % COUNT;
      }
    };
    if (at == null) {
      coughed.current = 0;
    } else if (c) {
      const t = performance.now() - at;
      while (coughed.current < COUGHS.length && t >= COUGHS[coughed.current]) {
        coughed.current++;
        puff(12, true);
        impact.current = { strength: 0.3, at: performance.now() };
      }
      acc.current += dt * 10;
      const thin = Math.floor(acc.current);
      acc.current -= thin;
      puff(thin, false);
    }
    for (const p of pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 1.2);
    }
    draw(mesh, pool, true);
  });

  return (
    <instancedMesh ref={ref} args={[geo, undefined, COUNT]} frustumCulled={false}>
      <meshStandardMaterial color="#3a3a42" emissive="#15151a" transparent opacity={0.55} depthWrite={false} roughness={1} />
    </instancedMesh>
  );
}
