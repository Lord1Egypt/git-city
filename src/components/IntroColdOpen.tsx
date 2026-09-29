"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import { cityPower } from "@/lib/city-power";

// ─── The home intro: the city turns on ───────────────────────
// SimCity / Cities: Skylines' power-on, over the real Bay. The city starts
// dark, only the bridges and the water lit; then the tallest tower downtown
// switches on and a wave of lit windows runs out across SF, Oakland and the
// whole Bay while the camera pulls back with it, and the page lands on the
// home view. One clock (this camera's) drives the terminal overlay too.
//
//   0.0–2.2  dark city from the water by the Bay Bridge, "booting git city..."
//   2.2–6.2  the wave: one tower, then everyone; the camera pulls back to
//            the whole Bay, "<n> developers online." counts what's lit
//   6.2–7.8  hold on the Bay glowing, "welcome to git city."
//   7.8      the home UI lands (OrbitScene glides to the home view)

export const COLD_OPEN = {
  wave: 2.2,
  reveal: 6.2,
  end: 7.8,
};

/** Where the home view rests. OrbitScene resets to this pose on mount. */
export const HOME_CAM: [number, number, number] = [-800, 700, -1000];
export const HOME_TARGET: [number, number, number] = [0, 70, 0];

/**
 * Shared state between the camera (writer) and the DOM overlay (reader, once
 * per animation frame). `online` is how many developers the wave has lit;
 * `handoff` tells OrbitScene whether to land from the intro's last frame or
 * cut straight to the home view (skip).
 */
export const coldOpen = {
  active: false,
  t: 0,
  online: 0,
  handoff: "cut" as "land" | "cut",
};

const START_CAM = new THREE.Vector3(1700, 220, -900);
const START_LOOK = new THREE.Vector3(0, 60, 0);
const WAVE_FROM = 80;
const WAVE_TO = 34000; // past the Bay's farthest corner
const REVEAL_R = 26000;
const REVEAL_PHI = 0.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoother = (v: number) => { const s = clamp01(v); return s * s * s * (s * (s * 6 - 15) + 10); };

const _pos = new THREE.Vector3();
const _target = new THREE.Vector3();
const _sph = new THREE.Spherical();

export function IntroColdOpen({ buildings, onEnd }: { buildings: CityBuilding[]; onEnd: () => void }) {
  const { camera, gl, scene } = useThree();
  const elapsed = useRef(0);
  const ended = useRef(false);

  const plan = useMemo(() => {
    // The wave starts on the tallest tower near downtown.
    let hero: CityBuilding | null = null;
    for (const b of buildings) {
      if (Math.hypot(b.position[0], b.position[2]) > 1500) continue;
      if (!hero || b.height > hero.height) hero = b;
    }
    const ox = hero?.position[0] ?? 0, oz = hero?.position[2] ?? 0;
    // Sorted distances from the origin, so "online" is a lookup per frame.
    const dists = new Float32Array(buildings.length);
    buildings.forEach((b, i) => { dists[i] = Math.hypot(b.position[0] - ox, b.position[2] - oz); });
    dists.sort();

    const from = new THREE.Spherical().setFromVector3(START_CAM.clone().sub(START_LOOK));
    const homeTheta = new THREE.Spherical().setFromVector3(new THREE.Vector3(...HOME_CAM).sub(new THREE.Vector3(...HOME_TARGET))).theta;
    let dTheta = homeTheta - from.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    return { ox, oz, dists, from, dTheta };
  }, [buildings]);

  useEffect(() => {
    coldOpen.active = true;
    coldOpen.t = 0;
    coldOpen.online = 0;
    coldOpen.handoff = "cut";
    cityPower.x = plan.ox;
    cityPower.z = plan.oz;
    cityPower.radius = 0;
    // Compile every material up front so nothing hitches as the city opens up.
    gl.compile(scene, camera);
    return () => {
      coldOpen.active = false;
      cityPower.radius = Infinity;
    };
  }, [gl, scene, camera, plan]);

  useFrame((_, delta) => {
    if (ended.current) return;
    // Clamp a long frame (tab switch, first-frame compile) so no beat is skipped.
    elapsed.current += Math.min(delta, 1 / 20);
    const t = elapsed.current;
    coldOpen.t = t;
    const p = plan;

    // The wave: exponential, so each second lights a ring ~4.5× wider.
    const w = (t - COLD_OPEN.wave) / (COLD_OPEN.reveal - COLD_OPEN.wave);
    const radius = w <= 0 ? 0 : WAVE_FROM * (WAVE_TO / WAVE_FROM) ** Math.min(1, w);
    cityPower.radius = w >= 1 ? Infinity : radius;
    // Buildings the jittered front has passed, roughly: those within the radius.
    let lo = 0, hi = p.dists.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (p.dists[m] <= radius) lo = m + 1; else hi = m; }
    coldOpen.online = w >= 1 ? p.dists.length : lo;

    // Camera: a slow drift toward the dark skyline, then a pull-back in log
    // space that keeps pace with the wave, turning to the home view's heading.
    const drift = Math.min(t, COLD_OPEN.wave) / COLD_OPEN.wave;
    const pull = smoother((t - COLD_OPEN.wave + 0.3) / (COLD_OPEN.reveal - COLD_OPEN.wave + 0.6));
    const hold = Math.max(0, t - COLD_OPEN.reveal);
    const r0 = p.from.radius * (1 - 0.12 * drift);
    const r = Math.exp(Math.log(r0) + (Math.log(REVEAL_R) - Math.log(r0)) * pull) + hold * 900;
    _sph.set(r, p.from.phi + (REVEAL_PHI - p.from.phi) * pull, p.from.theta + p.dTheta * pull);
    _target.set(...HOME_TARGET).lerp(START_LOOK, 1 - pull);
    _pos.setFromSpherical(_sph).add(_target);
    camera.position.copy(_pos);
    camera.lookAt(_target);

    if (t >= COLD_OPEN.end) {
      ended.current = true;
      coldOpen.handoff = "land";
      onEnd();
    }
  });

  return null;
}
