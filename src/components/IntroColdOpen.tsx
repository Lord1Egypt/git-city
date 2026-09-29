"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

// ─── The home intro: welcome to the city ─────────────────────
// Close on the lit downtown, one pull-out to the whole Bay while the terminal
// counts the developers, the welcome, then a dive back in that lands exactly
// on the home view (a Google Earth fly-to with a small settle). One clock (this
// camera's) drives the terminal overlay too.
//
//   0.0–2.4  low round the tallest tower downtown, "every building is a developer."
//   2.4–5.6  pull out to the whole Bay, "<n> developers." counts what's in frame
//   5.6–7.0  hold on the Bay, "welcome to git city."
//   7.0–9.2  dive back in, spiralling down to the home view; the UI lands

export const COLD_OPEN = {
  pull: 2.4,
  reveal: 5.6,
  dive: 7.0,
  end: 9.2,
};

/** Where the home view rests. OrbitScene resets to this pose on mount. */
export const HOME_CAM: [number, number, number] = [-800, 700, -1000];
export const HOME_TARGET: [number, number, number] = [0, 70, 0];

/**
 * Shared state between the camera (writer) and the DOM overlay (reader, once
 * per animation frame). `count` is how many developers the pull-out has
 * brought into frame.
 */
export const coldOpen = {
  active: false,
  t: 0,
  count: 0,
};

const REVEAL_R = 26000;
const REVEAL_PHI = 0.5;
const REVEAL_TURN = 0.35; // the reveal sits a little off the home heading, so the dive spirals in
const SETTLE = 0.82; // the dive overshoots to this share of the home distance, then eases back

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoother = (v: number) => { const s = clamp01(v); return s * s * s * (s * (s * 6 - 15) + 10); };
const easeInOut = (v: number) => { const s = clamp01(v); return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2; };
const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

const _pos = new THREE.Vector3();
const _target = new THREE.Vector3();
const _sph = new THREE.Spherical();

export function IntroColdOpen({ buildings, onEnd }: { buildings: CityBuilding[]; onEnd: () => void }) {
  const { camera, gl, scene } = useThree();
  const elapsed = useRef(0);
  const ended = useRef(false);

  const plan = useMemo(() => {
    let hero: CityBuilding | null = null;
    for (const b of buildings) {
      if (Math.hypot(b.position[0], b.position[2]) > 1500) continue;
      if (!hero || b.height > hero.height) hero = b;
    }
    const hh = Math.max(60, hero?.height ?? 200);
    const heroLook = new THREE.Vector3(hero?.position[0] ?? 0, hh * 0.6, hero?.position[2] ?? 0);
    const orbitR = Math.max(140, hh * 0.9);
    // Sorted distances from downtown, so the count is a lookup per frame.
    const dists = new Float32Array(buildings.length);
    buildings.forEach((b, i) => { dists[i] = Math.hypot(b.position[0], b.position[2]); });
    dists.sort();
    const home = new THREE.Spherical().setFromVector3(new THREE.Vector3(...HOME_CAM).sub(new THREE.Vector3(...HOME_TARGET)));
    return { hh, heroLook, orbitR, dists, home };
  }, [buildings]);

  useEffect(() => {
    coldOpen.active = true;
    coldOpen.t = 0;
    coldOpen.count = 0;
    // Compile every material up front so nothing hitches as the city opens up.
    gl.compile(scene, camera);
    return () => { coldOpen.active = false; };
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    if (ended.current) return;
    // Clamp a long frame (tab switch, first-frame compile) so no beat is skipped.
    elapsed.current += Math.min(delta, 1 / 20);
    const t = elapsed.current;
    coldOpen.t = t;
    const p = plan;
    const home = p.home;
    const openTheta = home.theta + 1.2;
    const openPhi = Math.acos((p.hh * 0.35 - p.heroLook.y) / Math.hypot(p.orbitR, p.hh * 0.35 - p.heroLook.y));
    const openR = Math.hypot(p.orbitR, p.hh * 0.35 - p.heroLook.y);

    if (t < COLD_OPEN.pull) {
      // Low round the tower, the lit city packed behind it.
      const u = t / COLD_OPEN.pull;
      _target.copy(p.heroLook);
      _sph.set(openR, openPhi, openTheta - 0.5 * (1 - u));
    } else if (t < COLD_OPEN.dive) {
      // One pull-out in log space (Powers of Ten), then a slow drift on the Bay.
      const u = (t - COLD_OPEN.pull) / (COLD_OPEN.reveal - COLD_OPEN.pull);
      const e = smoother(u);
      const hold = Math.max(0, t - COLD_OPEN.reveal);
      _target.copy(p.heroLook).lerp(_pos.set(...HOME_TARGET), smoother(u * 1.6));
      _sph.set(
        Math.exp(lerp(Math.log(openR), Math.log(REVEAL_R), e)) + hold * 600,
        lerp(openPhi, REVEAL_PHI, smoother(u * 1.3)),
        lerp(openTheta, home.theta + REVEAL_TURN, e),
      );
      const r = _sph.radius;
      let lo = 0, hi = p.dists.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (p.dists[m] <= r * 0.55) lo = m + 1; else hi = m; }
      coldOpen.count = u >= 1 ? p.dists.length : lo;
    } else {
      // Dive back in: accelerate down, overshoot a touch, settle on the home view.
      const u = (t - COLD_OPEN.dive) / (COLD_OPEN.end - COLD_OPEN.dive);
      const fromR = REVEAL_R + (COLD_OPEN.dive - COLD_OPEN.reveal) * 600;
      const down = easeInOut(u / 0.85);
      const settle = smoother((u - 0.85) / 0.15);
      const logR = lerp(lerp(Math.log(fromR), Math.log(home.radius * SETTLE), down), Math.log(home.radius), settle);
      _target.set(...HOME_TARGET);
      _sph.set(Math.exp(logR), lerp(REVEAL_PHI, home.phi, easeInOut(u)), lerp(home.theta + REVEAL_TURN, home.theta, easeInOut(u)));
    }

    _pos.setFromSpherical(_sph).add(_target);
    camera.position.copy(_pos);
    camera.lookAt(_target);

    if (t >= COLD_OPEN.end) {
      ended.current = true;
      onEnd();
    }
  });

  return null;
}
