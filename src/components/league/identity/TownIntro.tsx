"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import CarModel from "@/components/league/drive/CarModel";
import { WHEEL, M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import { chaseRig, type ChaseRig } from "@/lib/league-city/drive/camera";
import { WHEELS } from "@/lib/league-city/drive/vehicle";
import { carAt, type CarIntro, type IntroPose } from "@/lib/league-city/intro";

type Vec3 = [number, number, number];

// Plays the town intro (lib/league-city/intro): a car drives in from far out
// on the approach with the chase camera behind it; just past the arch the
// camera lifts on a curve to the scene's frame while the car brakes to a stop,
// and the orbit controls take over.
// With `handoff` the intro is the drive's opening shot instead: the camera
// settles into the drive camera's exact framing while the car slows to a
// roll, the drive's own car follows this one (`pose`) and takes its place as
// soon as it's loaded, and the intro ends with the car still moving.

/** Chase view, city units (drive mode's chase: 7 m back, 2.8 m up). */
const BACK = 18;
const UP = 5.5;
const AHEAD = 60;
/** The opening shot: pulled back and up, looking down at the car. */
const WIDE_BACK = 48;
const WIDE_UP = 32;
/** Share of the approach spent easing from the opening shot into the chase view. */
const SETTLE = 0.65;
/** Car not loaded yet at the handoff: it brakes to a stop over this long and waits. */
const WAIT_BRAKE = 1.5;

const _want = new THREE.Vector3();
const _look = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);

const smooth = (u: number) => u * u * (3 - 2 * u);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Camera behind a car heading north (−z) at (x, z). `wide` 1 is the opening
 * shot (back, up, looking down at the car), 0 the chase view (low, looking
 * down the road). `drive` 1 is the drive camera's own framing (`rig`).
 * Portrait screens sit further back, until the drive camera takes over.
 */
function chase(x: number, z: number, pos: THREE.Vector3, look: THREE.Vector3, far = 1, wide = 0, drive = 0, rig?: ChaseRig) {
  const f = mix(far, 1, drive);
  const r = rig ?? chaseRig(1);
  const back = mix((BACK + (WIDE_BACK - BACK) * wide) * f, r.back, drive);
  const up = mix((UP + (WIDE_UP - UP) * wide) * f, r.up, drive);
  pos.set(x, up, z + back);
  // Wide: aim a little past the car, so it sits low in frame with the arch and city above.
  look.set(x, mix(6 - 6 * wide, r.lookUp, drive), z - mix(AHEAD + 16 * wide, r.ahead, drive));
}

export interface IntroHandoff {
  /** Written every frame: where the drive's car should be. */
  pose: React.MutableRefObject<IntroPose | null>;
  /** The drive's car is loaded: this one hides, and the intro may end. */
  ready: boolean;
  /** Bumped by Skip: jump to the handoff. */
  skip: number;
}

export default function TownIntro({
  intro,
  end,
  color,
  ceiling,
  handoff,
  poseRef,
  onEnd,
  onTick,
}: {
  intro: CarIntro;
  end: { pos: Vec3; look: Vec3 };
  color: string;
  /** Height that clears every building: the camera goes up to it before swinging out. */
  ceiling: number;
  /** The drive takes the car at the end (see above). */
  handoff?: IntroHandoff;
  /** Handoff: written every frame, where the drive's car should be (handoff.pose). */
  poseRef?: React.MutableRefObject<IntroPose | null>;
  onEnd: () => void;
  /** Seconds into the intro, every frame (the title follows this clock). */
  onTick?: (t: number) => void;
}) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const far = aspect < 1 ? 1.6 : 1;
  const rig = useMemo(() => chaseRig(aspect), [aspect]);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const car = useRef<THREE.Group>(null);
  const wheelRefs = useRef<(THREE.Object3D | null)[]>([]);
  const state = useRef({ t: 0, ended: false, spin: 0, skipped: false });
  const cam = useRef({ look: new THREE.Vector3(), fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3() });
  const endPos = useMemo(() => new THREE.Vector3(...end.pos), [end]);
  const endLook = useMemo(() => new THREE.Vector3(...end.look), [end]);
  const driving = !!handoff;
  const ready = handoff?.ready ?? false;
  const skip = handoff?.skip ?? 0;

  useEffect(() => {
    chase(intro.x, intro.startZ, _want, _look, far, 1);
    camera.position.copy(_want);
    camera.lookAt(_look);
    cam.current.look.copy(_look);
    // The camera lets go of the car here.
    chase(intro.x, intro.switchZ, cam.current.fromPos, cam.current.fromLook, far);
  }, [camera, intro, far]);

  useEffect(() => {
    if (skip > 0) state.current.skipped = true;
  }, [skip]);

  // Skipped: cut straight to the city frame, as games do. When the drive
  // takes over, the orbit flies home on its own if the drive failed.
  useEffect(
    () => () => {
      if (poseRef) poseRef.current = null;
      // Cut short mid-handoff (the drive failed): the orbit's lens back.
      const base = camera.userData.baseFov as number | undefined;
      if (!state.current.ended && base !== undefined && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = base;
        camera.updateProjectionMatrix();
        delete camera.userData.baseFov;
      }
      if (state.current.ended || driving) return;
      camera.position.copy(endPos);
      camera.lookAt(endLook);
      if (controls) {
        controls.target.copy(endLook);
        controls.update();
      }
    },
    [camera, controls, endPos, endLook, driving, poseRef],
  );

  useFrame((_, delta) => {
    const st = state.current;
    if (st.ended) return;
    const dt = Math.min(delta, 0.05);
    const handoffAt = intro.cruise + intro.rise;
    // Skip lands on the handoff, as if the intro had played out.
    if (driving && st.skipped && st.t < handoffAt) st.t = handoffAt;
    st.t += dt;
    onTick?.(st.t);
    let { z, speed } = carAt(intro, st.t);
    if (driving && st.t > handoffAt) {
      // Still waiting for the drive's car: roll to a stop and wait.
      const u = Math.min(st.t - handoffAt, WAIT_BRAKE);
      const decel = intro.endSpeed / WAIT_BRAKE;
      z = intro.stopZ - intro.endSpeed * u + (decel * u * u) / 2;
      speed = intro.endSpeed - decel * u;
    }
    if (poseRef) poseRef.current = { x: intro.x, z, speed };

    // The car, heading north; wheels roll with its speed. Hidden once the
    // drive's car, right where it is, has taken its place.
    const g = car.current;
    if (g) {
      g.visible = !ready;
      g.position.set(intro.x, 0, z);
      g.rotation.set(0, Math.PI, 0);
      st.spin += (speed * dt) / (WHEEL.radius * M_TO_UNIT);
      WHEELS.forEach((w, i) => {
        const obj = wheelRefs.current[i];
        if (!obj) return;
        obj.position.set(w.x * M_TO_UNIT, (WHEEL.connectionY - WHEEL.restLength) * M_TO_UNIT, w.z * M_TO_UNIT);
        _q.setFromAxisAngle(_axisY, w.x < 0 ? Math.PI : 0);
        _spin.setFromAxisAngle(_axisX, st.spin * (w.x < 0 ? -1 : 1));
        obj.quaternion.copy(_q).multiply(_spin);
      });
    }

    const c = cam.current;
    if (driving) {
      // The chase view settles into the drive camera's framing while the car
      // slows, so when the drive camera takes over nothing moves.
      const wide = 1 - smooth(Math.min(1, st.t / (intro.cruise * SETTLE)));
      const settle = smooth(Math.min(1, Math.max(0, (st.t - intro.cruise) / intro.rise)));
      chase(intro.x, z, _want, c.look, far, wide, settle, rig);
      camera.position.copy(_want);
      camera.lookAt(c.look);
      // The lens opens to the drive camera's too; the drive puts the old one back on exit.
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.userData.baseFov ??= camera.fov;
        const fov = mix(camera.userData.baseFov as number, rig.fov, settle);
        if (Math.abs(fov - camera.fov) > 0.01) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
      }
      if (st.t < handoffAt || !ready) return;
      st.ended = true;
      onEnd();
      return;
    }

    if (st.t <= intro.cruise) {
      const wide = 1 - smooth(Math.min(1, st.t / (intro.cruise * SETTLE)));
      chase(intro.x, z, _want, c.look, far, wide);
      camera.position.copy(_want);
      camera.lookAt(c.look);
      return;
    }

    // Straight up, clear of every roof, then out to the frame (cubic Bézier
    // whose first handle is right above where the camera let go).
    const u = Math.min(1, (st.t - intro.cruise) / intro.rise);
    const e = smooth(u);
    const up = Math.max(ceiling, endPos.y);
    const i = 1 - e;
    const w0 = i * i * i;
    const w1 = 3 * i * i * e;
    const w2 = 3 * i * e * e;
    const w3 = e * e * e;
    camera.position.set(
      w0 * c.fromPos.x + w1 * c.fromPos.x + w2 * endPos.x + w3 * endPos.x,
      w0 * c.fromPos.y + w1 * up + w2 * up + w3 * endPos.y,
      w0 * c.fromPos.z + w1 * c.fromPos.z + w2 * endPos.z + w3 * endPos.z,
    );
    c.look.lerpVectors(c.fromLook, endLook, e);
    camera.lookAt(c.look);
    if (u < 1) return;
    st.ended = true;
    if (controls) {
      controls.target.copy(endLook);
      controls.update();
    }
    onEnd();
  });

  return (
    <group ref={car}>
      <Suspense fallback={null}>
        <CarModel color={color} wheelRefs={wheelRefs} />
      </Suspense>
    </group>
  );
}
