"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ALCATRAZ_LIGHTHOUSE } from "./SFLandmarks";

// ─── The home intro ─────────────────────────────────────────
// Four beats over the real Bay, one per line of the intro's text (prod's
// copy, in the letterbox's lower bar). One clock (this camera's) drives the
// overlay too, so the lines can't drift from the shots.
//
//   0.0–3.4   Alcatraz: round the lighthouse, the beam sweeping   "Somewhere in the internet..."
//   3.4–7.2   cut to the Golden Gate: dolly along the deck        "Developers became buildings"
//   7.2–10.4  zoom out from the bridge to the whole Bay           "And commits became floors"
//   10.4–13.4 dive to the centre, settling on the home view       "Welcome to Git City"
//   13.4–14   bars open, the UI lands

export const COLD_OPEN = {
  bridge: 3.4,
  zoom: 7.2,
  dive: 10.4,
  land: 13.4,
  end: 14,
  /** When each line of text comes in. */
  lines: [0.8, 4.2, 7.6, 11.0],
  barsOpen: 13.0,
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
const REVEAL_TURN = 0.35; // the Bay sits a little off the home heading, so the dive spirals in
const SETTLE = 0.82; // the dive overshoots to this share of the home distance, then eases back

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoother = (v: number) => { const s = clamp01(v); return s * s * s * (s * (s * 6 - 15) + 10); };
const easeInOut = (v: number) => { const s = clamp01(v); return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2; };
const lerp = (a: number, b: number, e: number) => a + (b - a) * e;
const turn = (from: number, to: number) => { const d = to - from; return Math.atan2(Math.sin(d), Math.cos(d)); };

const _pos = new THREE.Vector3();
const _target = new THREE.Vector3();
const _sph = new THREE.Spherical();

/** The Golden Gate dolly at u (0..1): camera and look point. */
function bridgePose(u: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const len = Math.hypot(GG_B[0] - GG_A[0], GG_B[1] - GG_A[1]);
  const ux = (GG_B[0] - GG_A[0]) / len, uz = (GG_B[1] - GG_A[1]) / len;
  const nx = uz, nz = -ux; // bay side
  const at = (s: number) => [GG_A[0] + ux * len * s, GG_A[1] + uz * len * s];
  const [cx, cz] = at(0.3 + 0.32 * u);
  pos.set(cx + nx * 180, 55 + 20 * u, cz + nz * 180);
  const [lx, lz] = at(0.42 + 0.32 * u);
  look.set(lx, 90, lz);
}

export function IntroColdOpen({ onEnd }: { onEnd: () => void }) {
  const { camera, gl, scene } = useThree();
  const elapsed = useRef(0);
  const ended = useRef(false);

  const plan = useMemo(() => {
    const home = new THREE.Spherical().setFromVector3(new THREE.Vector3(...HOME_CAM).sub(new THREE.Vector3(...HOME_TARGET)));
    const endPos = new THREE.Vector3(), endLook = new THREE.Vector3();
    bridgePose(1, endPos, endLook);
    const zoomFrom = new THREE.Spherical().setFromVector3(endPos.clone().sub(endLook));
    return { home, endLook, zoomFrom };
  }, []);

  useEffect(() => {
    coldOpen.active = true;
    coldOpen.t = 0;
    // Compile every material up front so the cut and the zoom don't hitch.
    gl.compile(scene, camera);
    return () => { coldOpen.active = false; };
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    if (ended.current) return;
    // Clamp a long frame (tab switch, first-frame compile) so no beat is skipped.
    elapsed.current += Math.min(delta, 1 / 20);
    const t = elapsed.current;
    coldOpen.t = t;
    const { home, endLook, zoomFrom } = plan;

    if (t < COLD_OPEN.bridge) {
      // Round the lighthouse from the north, the city lit behind the Rock.
      const u = t / COLD_OPEN.bridge;
      const L = ALCATRAZ_LIGHTHOUSE;
      const a = -Math.PI / 2 + 0.5 - 0.9 * u;
      _pos.set(L.x + Math.cos(a) * 380, 85 - 15 * u, L.z + Math.sin(a) * 380);
      _target.set(L.x, 35, L.z);
    } else if (t < COLD_OPEN.zoom) {
      bridgePose((t - COLD_OPEN.bridge) / (COLD_OPEN.zoom - COLD_OPEN.bridge), _pos, _target);
    } else if (t < COLD_OPEN.dive) {
      // Zoom out from the bridge to the whole Bay, in log space (Powers of Ten).
      const u = (t - COLD_OPEN.zoom) / (COLD_OPEN.dive - COLD_OPEN.zoom);
      const e = smoother(u);
      _target.copy(endLook).lerp(_pos.set(...HOME_TARGET), smoother(u * 1.4));
      _sph.set(
        Math.exp(lerp(Math.log(zoomFrom.radius), Math.log(REVEAL_R), e)),
        lerp(zoomFrom.phi, REVEAL_PHI, smoother(u * 1.2)),
        zoomFrom.theta + turn(zoomFrom.theta, home.theta + REVEAL_TURN) * e,
      );
      _pos.setFromSpherical(_sph).add(_target);
    } else {
      // Dive to the centre: accelerate down, overshoot a touch, settle on home.
      const u = Math.min(1, (t - COLD_OPEN.dive) / (COLD_OPEN.land - COLD_OPEN.dive));
      const down = easeInOut(u / 0.85);
      const settle = smoother((u - 0.85) / 0.15);
      const logR = lerp(lerp(Math.log(REVEAL_R), Math.log(home.radius * SETTLE), down), Math.log(home.radius), settle);
      _target.set(...HOME_TARGET);
      _sph.set(Math.exp(logR), lerp(REVEAL_PHI, home.phi, easeInOut(u)), home.theta + REVEAL_TURN * (1 - easeInOut(u)));
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
