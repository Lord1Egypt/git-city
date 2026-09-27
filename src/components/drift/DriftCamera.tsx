"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CarApi } from "@/components/league/drive/Car";
import { chaseRig } from "@/lib/league-city/drive/camera";
import { CAMERA, M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { DriveCameraMode } from "@/lib/league-city/drive/telemetry";
import type { TrialStage } from "@/lib/league-city/race/trial";

// The drift camera, one continuous shot like the town intro (no flyover, no
// cut): on the title it holds a wide view from behind and above the car, the
// spot and the city ahead; through 3-2-1 it comes down onto the town's chase
// framing and lands there at GO. Driving, it sits behind where the car is
// going rather than where the nose points, so a 60° drift doesn't swing the
// view (the nose leads a little, so you still see the angle). Past the line
// it rises and circles the car while the results are up.

const WIDE_BACK = 60;
const WIDE_UP = 38;
/** Share of the travel direction in the camera's heading (the rest is the nose). */
const FOLLOW_TRAVEL = 0.7;

const _fwd = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _want = new THREE.Vector3();
const _look = new THREE.Vector3();
const _wideP = new THREE.Vector3();
const _wideL = new THREE.Vector3();

const ease = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);

export default function DriftCamera({
  car,
  mode,
  stage,
  stageAt,
  countdownMs,
}: {
  car: React.MutableRefObject<CarApi | null>;
  mode: DriveCameraMode;
  stage: TrialStage;
  stageAt: number;
  /** How long 3-2-1 lasts (ms): the descent takes exactly this long. */
  countdownMs: number;
}) {
  const heading = useRef<THREE.Vector3 | null>(null);
  const spring = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), ready: false });
  const orbit = useRef(0);

  useFrame((three, dt) => {
    const camera = three.camera as THREE.PerspectiveCamera;
    const c = car.current;
    if (!c) return;
    const g = c.group;
    const rig = chaseRig(three.size.width / Math.max(1, three.size.height));

    // Heading: mostly the direction of travel, a little of the nose.
    _fwd.set(0, 0, 1).applyQuaternion(g.quaternion);
    _fwd.y = 0;
    _fwd.normalize();
    const v = c.body.linvel();
    _vel.set(v.x, 0, v.z);
    const speed = _vel.length();
    if (speed > 3) _fwd.lerp(_vel.normalize(), FOLLOW_TRAVEL).normalize();
    heading.current ??= _fwd.clone();
    heading.current.lerp(_fwd, 1 - Math.exp(-5 * dt)).normalize();
    const h = heading.current;

    // The chase framing (the town's), and the wide one from behind and above.
    if (mode === "chase") {
      _want.copy(g.position).addScaledVector(h, -rig.back);
      _want.y = g.position.y + rig.up;
      _look.copy(g.position).addScaledVector(h, rig.ahead);
      _look.y += rig.lookUp;
    } else {
      _want.copy(g.position).addScaledVector(h, -10);
      _want.y = g.position.y + CAMERA.topDownHeight * M_TO_UNIT;
      _look.copy(g.position);
    }
    _wideP.copy(g.position).addScaledVector(h, -WIDE_BACK);
    _wideP.y = g.position.y + WIDE_UP;
    _wideL.copy(g.position).addScaledVector(h, 70);
    _wideL.y = 10;

    const now = performance.now();
    let k = 0; // 0 wide, 1 chase
    if (stage === "menu" || stage === "intro") k = 0;
    else if (stage === "countdown") k = ease(Math.min(1, (now - stageAt) / Math.max(1, countdownMs)));
    else k = 1;

    if (stage === "finish") {
      // Up and around the car while the results show.
      orbit.current += dt * 0.25;
      const a = Math.atan2(h.x, h.z) + Math.PI + orbit.current;
      _want.set(g.position.x + Math.sin(a) * 34, g.position.y + 22, g.position.z + Math.cos(a) * 34);
      _look.copy(g.position);
    } else {
      orbit.current = 0;
      _want.lerpVectors(_wideP, _want, k);
      _look.lerpVectors(_wideL, _look, k);
    }

    const sp = spring.current;
    if (!sp.ready) {
      sp.pos.copy(_want);
      sp.look.copy(_look);
      sp.ready = true;
    }
    // Tight on the chase so the countdown lands exactly; softer elsewhere.
    const rate = stage === "run" ? CAMERA.follow : stage === "countdown" ? 20 : 3;
    const f = 1 - Math.exp(-rate * dt);
    sp.pos.lerp(_want, f);
    sp.look.lerp(_look, Math.min(1, f * 2));
    camera.position.copy(sp.pos);
    camera.lookAt(sp.look);

    const speedT = Math.min(1, speed / 26);
    const target = mode === "chase" && stage === "run" ? rig.fov + (rig.fovBoost - rig.fov) * speedT * 0.4 : rig.fov;
    const fov = THREE.MathUtils.lerp(camera.fov, target, 1 - Math.exp(-4 * dt));
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
