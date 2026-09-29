"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import { ALCATRAZ_LIGHTHOUSE } from "./SFLandmarks";

// ─── The home intro ─────────────────────────────────────────
// Five takes over the real Bay, told as a git log typed into the game's
// terminal (IntroColdOpenOverlay), one command per take, typed on its cut.
// One clock (this camera's) drives the overlay too.
//
//   0.0–3.0   Alcatraz: round the lighthouse         $ git init city
//   3.0–6.0   cut, Golden Gate: dolly along the deck  $ git add developers
//   6.0–9.0   cut, the tallest tower downtown: climb its facade to the roof
//                                                    $ git commit --floors
//   9.0–12.2  from the roof, one smooth pull-out to the whole Bay
//                                                    87,640 contributors.
//   12.2–15.2 dive to the centre, settling on the home view
//                                                    Welcome to Git City.
//   15.6      the UI lands

export const COLD_OPEN = {
  bridge: 3.0,
  climb: 6.0,
  zoom: 9.0,
  dive: 12.2,
  land: 15.2,
  end: 15.6,
};

/** Where the home view rests. OrbitScene resets to this pose on mount. */
export const HOME_CAM: [number, number, number] = [-800, 700, -1000];
export const HOME_TARGET: [number, number, number] = [0, 70, 0];

/** The camera's clock, read by the overlay once per animation frame. */
export const coldOpen = { active: false, t: 0 };

const GG_A: [number, number] = [-6962, -3971]; // north (Marin) end
const GG_B: [number, number] = [-6750, -1673]; // south (SF) end
const REVEAL_R = 22000;
const REVEAL_PHI = 0.55;
const REVEAL_TURN = 0.35; // the climb and the Bay sit a little off the home heading, so the dive spirals in
const SETTLE = 0.82; // the dive overshoots to this share of the home distance, then eases back

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoother = (v: number) => { const s = clamp01(v); return s * s * s * (s * (s * 6 - 15) + 10); };
const easeInOut = (v: number) => { const s = clamp01(v); return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2; };
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;
const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

const _pos = new THREE.Vector3();
const _target = new THREE.Vector3();
const _sph = new THREE.Spherical();

/** The Golden Gate dolly at u (0..1): camera and look point. */
function bridgePose(u: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const len = Math.hypot(GG_B[0] - GG_A[0], GG_B[1] - GG_A[1]);
  const ux = (GG_B[0] - GG_A[0]) / len, uz = (GG_B[1] - GG_A[1]) / len;
  const nx = uz, nz = -ux; // bay side
  const at = (s: number) => [GG_A[0] + ux * len * s, GG_A[1] + uz * len * s];
  const [cx, cz] = at(0.32 + 0.26 * u);
  pos.set(cx + nx * 180, 55 + 20 * u, cz + nz * 180);
  const [lx, lz] = at(0.44 + 0.26 * u);
  look.set(lx, 90, lz);
}

export function IntroColdOpen({ buildings, onEnd }: { buildings: CityBuilding[]; onEnd: () => void }) {
  const { camera, gl, scene } = useThree();
  const elapsed = useRef(0);
  const ended = useRef(false);

  const plan = useMemo(() => {
    const home = new THREE.Spherical().setFromVector3(new THREE.Vector3(...HOME_CAM).sub(new THREE.Vector3(...HOME_TARGET)));
    // The climb: the tallest tower near downtown, seen from the home heading
    // turned a little, far enough back to frame its width.
    let hero: CityBuilding | null = null;
    for (const b of buildings) {
      if (Math.hypot(b.position[0], b.position[2]) > 1500) continue;
      if (!hero || b.height > hero.height) hero = b;
    }
    const top = Math.max(60, hero?.height ?? 200);
    const base = new THREE.Vector3(hero?.position[0] ?? 0, 0, hero?.position[2] ?? 0);
    const back = Math.max(70, (hero?.width ?? 30) * 3);
    return { home, top, base, back, theta: home.theta + REVEAL_TURN };
  }, [buildings]);

  useEffect(() => {
    coldOpen.active = true;
    coldOpen.t = 0;
    // Compile every material up front so the cuts don't hitch.
    gl.compile(scene, camera);
    return () => { coldOpen.active = false; };
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    if (ended.current) return;
    // Clamp a long frame (tab switch, first-frame compile) so no beat is skipped.
    elapsed.current += Math.min(delta, 1 / 20);
    const t = elapsed.current;
    coldOpen.t = t;
    const { home, top, base, back, theta } = plan;

    if (t < COLD_OPEN.bridge) {
      // Round the lighthouse from the north, the city lit behind the Rock.
      const u = t / COLD_OPEN.bridge;
      const L = ALCATRAZ_LIGHTHOUSE;
      const a = -Math.PI / 2 + 0.45 - 0.8 * u;
      _pos.set(L.x + Math.cos(a) * 380, 85 - 15 * u, L.z + Math.sin(a) * 380);
      _target.set(L.x, 35, L.z);
    } else if (t < COLD_OPEN.climb) {
      bridgePose((t - COLD_OPEN.bridge) / (COLD_OPEN.climb - COLD_OPEN.bridge), _pos, _target);
    } else if (t < COLD_OPEN.zoom) {
      // Up the facade floor by floor, easing out as it clears the roof.
      const u = easeOut((t - COLD_OPEN.climb) / (COLD_OPEN.zoom - COLD_OPEN.climb));
      const y = lerp(10, top + 12, u);
      _target.set(base.x, y + lerp(25, 0, u), base.z);
      _sph.set(back, Math.PI / 2, theta);
      _pos.setFromSpherical(_sph).add(_target);
      _pos.y = y;
    } else if (t < COLD_OPEN.dive) {
      // One smooth pull-out from the roof to the whole Bay: the distance grows
      // in log space (Powers of Ten), the heading stays, the view tips down.
      const e = smoother((t - COLD_OPEN.zoom) / (COLD_OPEN.dive - COLD_OPEN.zoom));
      _target.set(base.x, top + 12, base.z).lerp(_pos.set(...HOME_TARGET), e);
      _sph.set(Math.exp(lerp(Math.log(back), Math.log(REVEAL_R), e)), lerp(Math.PI / 2, REVEAL_PHI, e), theta);
      _pos.setFromSpherical(_sph).add(_target);
    } else {
      // Dive to the centre: accelerate down, overshoot a touch, settle on home.
      const u = Math.min(1, (t - COLD_OPEN.dive) / (COLD_OPEN.land - COLD_OPEN.dive));
      const down = easeInOut(u / 0.85);
      const settle = smoother((u - 0.85) / 0.15);
      const logR = lerp(lerp(Math.log(REVEAL_R), Math.log(home.radius * SETTLE), down), Math.log(home.radius), settle);
      _target.set(...HOME_TARGET);
      _sph.set(Math.exp(logR), lerp(REVEAL_PHI, home.phi, easeInOut(u)), lerp(theta, home.theta, easeInOut(u)));
      _pos.setFromSpherical(_sph).add(_target);
    }

    camera.position.copy(_pos);
    camera.lookAt(_target);

    if (t >= COLD_OPEN.end) {
      ended.current = true;
      onEnd();
    }
  });

  return null;
}
