"use client";

import { Suspense, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CarModel from "@/components/league/drive/CarModel";
import { Bursts, type VoxelBursts } from "@/components/league/drive/Voxels";
import { M_TO_UNIT, TURBO, WHEEL } from "@/lib/league-city/drive/tuning";
import { WHEELS } from "@/lib/league-city/drive/vehicle";
import { RAMP_BIG } from "@/lib/league-city/ramp";
import { beatOf, type FilmClock } from "@trailer-kit/clock";
import { BEAT, DRIFT_IN, LAUNCH, TAKEOFF, shotFor, type Stage } from "@/lib/trailer/demo/film";
import { JUMP_Z, LANE, PARK_Z, RAMP_Z, TURN_Z } from "@/lib/trailer/demo/world";

// One stage's camera and car for the demo film (lib/trailer/demo/film). Every
// frame it reads the film's clock, asks which of this stage's shots is under
// way and how far into it (t, in seconds of the take's action), and poses the
// car and the camera as a pure function of t: the same t always gives the
// same picture, so scrubbing, looping, slow motion and recording all agree.
// Only the particles have memory, so they're emitted only while the clock
// moves (a paused frame stays as it is).

const SMOKE = ["#d9d6de", "#bdb9c4", "#ece9ef", "#a7a2b0"];
const BASE_FOV = 50;

/** Burnout: how hard the car pulls away after the launch (units/s²). */
const LAUNCH_ACCEL = 150;
/** Drift: speed and corner radius (units), and how long the slide takes (s). */
const DRIFT_SPEED = 55;
const DRIFT_R = 30;
const DRIFT_ARC = 0.95;
/** Jump: speed on the ramp (units/s) and gravity (units/s²). */
const JUMP_SPEED = 95;
const JUMP_G = 55;

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

/**
 * The drift's path at t: north up the main street's right lane, a right turn
 * of radius DRIFT_R into the cross street at TURN_Z (taken wide, into its far
 * lane), then east. `slip` is how far the tail swings out, `v` the progress
 * round the corner (0 to 1).
 */
function driftAt(t: number) {
  const lead = DRIFT_IN * BEAT;
  const x0 = LANE;
  const zTurn = TURN_Z - LANE + DRIFT_R;
  let x: number, z: number, heading: number;
  if (t < lead) {
    x = x0;
    z = zTurn + DRIFT_SPEED * (lead - t);
    heading = Math.PI;
  } else if (t < lead + DRIFT_ARC) {
    const phi = ((t - lead) / DRIFT_ARC) * (Math.PI / 2);
    x = x0 + DRIFT_R - DRIFT_R * Math.cos(phi);
    z = zTurn - DRIFT_R * Math.sin(phi);
    heading = Math.PI - phi;
  } else {
    x = x0 + DRIFT_R + DRIFT_SPEED * (t - lead - DRIFT_ARC);
    z = zTurn - DRIFT_R;
    heading = Math.PI / 2;
  }
  const v = (t - lead) / DRIFT_ARC;
  const slip = 0.75 * smooth(clamp01(v / 0.22)) * (1 - smooth(clamp01((v - 0.85) / 0.45)));
  return { x, z, heading, slip, v };
}

/** The jump's path at t: up the ramp, off its lip on TAKEOFF, a parabola over the cross street. */
function jumpAt(t: number) {
  const foot = RAMP_Z + RAMP_BIG.length / 2;
  const lip = RAMP_Z - RAMP_BIG.length / 2;
  const slope = RAMP_BIG.height / RAMP_BIG.length;
  const off = TAKEOFF * BEAT;
  const z = lip + JUMP_SPEED * (off - t);
  if (z > foot) return { z, y: 0, pitch: 0 };
  if (z > lip) return { z, y: (foot - z) * slope, pitch: -Math.atan(slope) };
  const air = t - off;
  const vy = JUMP_SPEED * slope;
  return {
    z,
    y: Math.max(0, RAMP_BIG.height + vy * air - 0.5 * JUMP_G * air * air),
    pitch: -Math.atan((vy - JUMP_G * air) / JUMP_SPEED) * 0.8,
  };
}

export default function DemoRig({ stage, clock, color }: { stage: Stage; clock: FilmClock; color: string }) {
  const camera = useThree((s) => s.camera);
  const car = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Object3D | null)[]>([]);
  const bursts = useRef<VoxelBursts | null>(null);
  const st = useRef({ last: -1, shake: 0, spin: 0 });

  /** Puts the car at (x, y, z) facing `yaw` (π is north), wheels turning at `wheelSpeed`. */
  const pose = (x: number, y: number, z: number, yaw: number, pitch: number, wheelSpeed: number, dt: number) => {
    const g = car.current;
    if (!g) return;
    g.position.set(x, y, z);
    g.rotation.set(pitch, yaw, 0);
    st.current.spin += (wheelSpeed * dt) / (WHEEL.radius * M_TO_UNIT);
    WHEELS.forEach((w, i) => {
      const o = wheels.current[i];
      if (!o) return;
      o.position.set(w.x * M_TO_UNIT, (WHEEL.connectionY - WHEEL.restLength) * M_TO_UNIT, w.z * M_TO_UNIT);
      _q.setFromAxisAngle(_axisY, w.x < 0 ? Math.PI : 0);
      _spin.setFromAxisAngle(_axisX, st.current.spin * (w.x < 0 ? -1 : 1));
      o.quaternion.copy(_q).multiply(_spin);
    });
  };

  /** Where a rear wheel touches the road, in world space, for the smoke. */
  const rearWheels = (x: number, z: number, yaw: number) =>
    [WHEELS[2], WHEELS[3]].map((w) => {
      const lx = w.x * M_TO_UNIT;
      const lz = w.z * M_TO_UNIT;
      return [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    });

  useFrame((three, delta) => {
    const dt = Math.min(delta, 0.05);
    const beat = beatOf(clock);
    const fx = beat !== st.current.last ? bursts.current : null;
    st.current.last = beat;
    // The camera shake decays in film time, so a paused frame holds still.
    if (fx) st.current.shake = Math.max(0, st.current.shake - dt * 2.2);
    const { shot, t } = shotFor(stage, Math.max(0, beat));
    let lens = BASE_FOV;
    let amp = 0.3;

    if (shot.kind === "burnout") {
      // The hook, split screen: both cars from low behind, rear wheels
      // spinning in their smoke, the body shaking; both launch on the hit.
      const go = LAUNCH * BEAT;
      const u = Math.max(0, t - go);
      const k = clamp01(t / go);
      const z = PARK_Z - 0.5 * LAUNCH_ACCEL * u * u;
      const shakeBody = t < go ? 0.05 * Math.sin(t * 70) * (0.4 + k) : 0;
      pose(LANE, shakeBody, z, Math.PI, t < go ? -0.03 * k : 0.05 * Math.max(0, 1 - u * 3), t < go ? 25 + 170 * k * k : LAUNCH_ACCEL * u + 60, dt);
      if (t < go + 0.4)
        for (const [wx, wz] of rearWheels(LANE, z, Math.PI))
          fx?.burst(wx, 0.5, wz + 0.8, { count: 1, speed: 1.5 + 2 * k, colors: SMOKE, size: 0.5 + 0.5 * k, life: 1.1, gravity: -1.5, flat: 0.6 });
      if (fx) st.current.shake = Math.max(st.current.shake, t < go ? 0.08 + 0.12 * k : 0.5 * Math.max(0, 1 - u / 0.3));
      // Low behind; it eases forward a little when the car goes.
      const push = smooth(clamp01(u / 0.4));
      _pos.set(LANE, 2.4 + 0.6 * push, PARK_Z + 17 - 3 * push);
      _look.set(LANE, 2.8, PARK_Z - 30);
      lens = 46;
    } else if (shot.kind === "drift") {
      // Up the street, then the tail out through a right turn in its own
      // smoke, the mini-turbo sparks going blue, orange, purple. The chase
      // camera is slow to turn: its heading lags a quarter second, so the car
      // slides across the lens and shows its flank.
      const p = driftAt(t);
      const yaw = p.heading - p.slip;
      pose(p.x, 0, p.z, yaw, 0, DRIFT_SPEED, dt);
      if (car.current) car.current.rotation.z = -0.05 * p.slip;
      if (p.slip > 0.15) {
        const spark = [TURBO.colors[p.v < 0.35 ? 1 : p.v < 0.7 ? 2 : 3]];
        for (const [wx, wz] of rearWheels(p.x, p.z, yaw)) {
          fx?.burst(wx, 0.6, wz, { count: 1, speed: 2.5, colors: SMOKE, size: 0.7 + 0.5 * p.slip, life: 1.1, gravity: -1.2, flat: 0.6 });
          fx?.burst(wx, 0.4, wz, { count: 1, speed: 4, colors: spark, size: 0.35, life: 0.22, gravity: 20 });
        }
        if (fx) st.current.shake = Math.max(st.current.shake, 0.12);
      }
      const lag = driftAt(Math.max(0, t - 0.28));
      const fxz = Math.sin(lag.heading);
      const fzz = Math.cos(lag.heading);
      _pos.set(p.x - fxz * 14, 4.2, p.z - fzz * 14);
      _look.set(p.x + fxz * 10, 2.4, p.z + fzz * 10);
      lens = 52;
      amp = 0.4;
    } else {
      // Up the ramp and off it over the cross street, from low in that
      // street looking across: the car crosses the frame right to left
      // against the sky, a boost flame behind it. The take freezes mid-air.
      const p = jumpAt(t);
      pose(LANE, p.y, p.z, Math.PI, p.pitch, JUMP_SPEED, dt);
      fx?.burst(LANE, p.y + 1.2, p.z + 5, { count: 2, speed: 3, colors: [TURBO.colors[1], "#ffffff", TURBO.colors[2]], size: 0.9, life: 0.35, gravity: 0 });
      const lip = RAMP_Z - RAMP_BIG.length / 2;
      // The lens closes in as the car leaves the ramp, so it's big in the frame when it freezes.
      _pos.set(-36, 1.5, JUMP_Z);
      _look.set(LANE, 8 + p.y * 0.8, p.z - 4 + Math.max(0, p.z - lip) * 0.5);
      lens = 42 - 14 * smooth(clamp01((t - TAKEOFF * BEAT) / 0.5));
    }

    const k = st.current.shake;
    if (k > 0) {
      // Seeded by the beat, so a paused or scrubbed frame shakes the same way every time.
      const n = beat * BEAT;
      _pos.x += Math.sin(n * 71) * 1.6 * k * amp;
      _pos.y += Math.cos(n * 53) * 1.2 * k * amp;
    }
    const cam = three.camera;
    if (cam instanceof THREE.PerspectiveCamera && cam.fov !== lens) {
      cam.fov = lens;
      cam.updateProjectionMatrix();
    }
    camera.position.copy(_pos);
    camera.lookAt(_look);
  });

  return (
    <>
      <group ref={car}>
        <Suspense fallback={null}>
          <CarModel color={color} wheelRefs={wheels} />
        </Suspense>
      </group>
      <Bursts ref={bursts} />
    </>
  );
}
