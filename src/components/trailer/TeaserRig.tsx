"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CarModel from "@/components/league/drive/CarModel";
import { Bursts, FIRE, type VoxelBursts } from "@/components/league/drive/Voxels";
import { M_TO_UNIT, WHEEL } from "@/lib/league-city/drive/tuning";
import { WHEELS } from "@/lib/league-city/drive/vehicle";
import { LANE } from "@/lib/league-city/intro";
import type { SmashStore } from "@/lib/league-city/smash";
import {
  BEAT,
  BLASTS,
  COLLAPSE,
  LOT,
  shotFor,
  type SmashRun,
  type Stage,
} from "@/lib/trailer/teaser";

// One town's camera and car for the teaser (lib/trailer/teaser): it reads the
// shared clock every frame and plays whichever of this town's shots is under
// way, or holds the next one on its first frame while the other town is on
// screen. The smashing goes through the same store the game draws.

export interface TeaserClock {
  /** performance.now() of beat 0 while it plays. */
  start: number;
  /** Playback speed: below 1 is slow motion. */
  rate: number;
  /** Paused on this beat, or null while it plays. */
  held: number | null;
}

/** The studio's clock: play from a beat, hold on one, change speed. */
export class TeaserTransport implements TeaserClock {
  start = 0;
  rate = 1;
  held: number | null;
  constructor(beat: number) {
    this.held = beat;
  }
  play(beat: number) {
    this.held = null;
    this.start = performance.now() - (beat * BEAT * 1000) / this.rate;
  }
  hold(beat: number) {
    this.held = beat;
  }
  speed(rate: number) {
    const beat = beatOf(this);
    this.rate = rate;
    if (this.held === null) this.play(beat);
  }
}

/** Beats since the film's first frame (negative during the pre-roll). */
export function beatOf(clock: TeaserClock): number {
  if (clock.held !== null) return clock.held;
  return ((performance.now() - clock.start) * clock.rate) / 1000 / BEAT;
}

const DEBRIS = ["#1c2233", "#2a3147", "#ffd76a", "#ffe9a8", "#8fa3c7", "#3a4462"];
const CHUNK = ["#141a2a"];

/** Arrival: the car crosses under the arch this long into the shot (s). */
const CROSS = 1.0;
const ARRIVAL_SPEED = 55;
const INVADE_SPEED = 62;
/** Rev: the burnout lasts this long, then the car launches (s, units/s²). */
const REV_LAUNCH = 1.2;
/** The long lens on the wheel from across the street, and how wide it opens for the launch. */
const REV_DIST = 24;
const REV_FOV = 11;
const REV_WIDE = 30;
const BASE_FOV = 50;
const REV_ACCEL = 150;
const SMOKE = ["#d9d6de", "#bdb9c4", "#ece9ef", "#a7a2b0"];
/** Implosion: one floor off every column this often (s). */
const FLOOR_EVERY = 0.045;

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);

const smooth = (u: number) => u * u * (3 - 2 * u);

export default function TeaserRig({
  stage,
  clock,
  h,
  gateZ,
  revZ,
  run,
  store,
  homeColor,
  rivalColor,
  attacker,
}: {
  stage: Stage;
  clock: TeaserClock;
  h: number;
  /** World z of the portal. */
  gateZ: number;
  /** Where the burnout car waits on the main street (a plain stretch of road). */
  revZ: number;
  run: SmashRun | null;
  store: SmashStore;
  /** This town's side: the arrival car. */
  homeColor: string;
  /** The other side: the car that breaks this town. */
  rivalColor: string;
  /** Planted on the rubble when the tower falls. */
  attacker: string;
}) {
  const camera = useThree((s) => s.camera);
  const home = useRef<THREE.Group>(null);
  const rival = useRef<THREE.Group>(null);
  const homeWheels = useRef<(THREE.Object3D | null)[]>([]);
  const rivalWheels = useRef<(THREE.Object3D | null)[]>([]);
  const bursts = useRef<VoxelBursts | null>(null);
  const st = useRef({ last: -1, shake: 0, spin: 0, amp: 1 });

  // The tower is the run's last (tallest) building.
  const tower = useMemo(
    () => (run ? store.index.get(run.buildings[run.buildings.length - 1].loginLower) : undefined),
    [run, store],
  );
  const cityZ = ((-2 * h + 1) * LOT) / 2;
  const width = (2 * h + 1) * LOT;
  const side = run && run.x > 0 ? -1 : 1;

  const pose = (
    g: THREE.Group | null,
    wheels: (THREE.Object3D | null)[],
    x: number,
    z: number,
    speed: number,
    dt: number,
    /** How fast the wheels turn (units/s), when it isn't the car's speed (a burnout). */
    wheelSpeed = speed,
    /** Body bounce (units) and squat (radians). */
    bob = 0,
    squat = 0,
    /** Heading: π faces north (−z), 0 faces south (+z). */
    yaw = Math.PI,
  ) => {
    if (!g) return;
    g.visible = true;
    g.position.set(x, bob, z);
    g.rotation.set(squat, yaw, 0);
    st.current.spin += (wheelSpeed * dt) / (WHEEL.radius * M_TO_UNIT);
    WHEELS.forEach((w, i) => {
      const o = wheels[i];
      if (!o) return;
      o.position.set(
        w.x * M_TO_UNIT,
        (WHEEL.connectionY - WHEEL.restLength) * M_TO_UNIT,
        w.z * M_TO_UNIT,
      );
      _q.setFromAxisAngle(_axisY, w.x < 0 ? Math.PI : 0);
      _spin.setFromAxisAngle(_axisX, st.current.spin * (w.x < 0 ? -1 : 1));
      o.quaternion.copy(_q).multiply(_spin);
    });
  };

  const burst = (x: number, y: number, z: number, floorH: number, big: boolean) => {
    bursts.current?.burst(x, y, z, {
      count: 1,
      speed: 22,
      colors: CHUNK,
      size: floorH * 0.85,
      life: 1.6,
      gravity: 60,
    });
    bursts.current?.burst(x, y, z, {
      count: big ? 22 : 8,
      speed: big ? 38 : 24,
      colors: DEBRIS,
      size: Math.min(2.2, floorH * 0.3),
      life: 1.1,
    });
  };

  const smash = (x: number, z: number, r: number, rows: number, cooldown: number, big: boolean) => {
    const hits = store.hitCircle(x, z, r, rows, Date.now(), cooldown, attacker);
    for (const hit of hits) burst(hit.x, hit.y, hit.z, store.targets[hit.target].floorH, big);
    if (hits.length) st.current.shake = Math.max(st.current.shake, big ? 1 : 0.35);
  };

  useFrame((three, delta) => {
    const dt = Math.min(delta, 0.05);
    const beat = beatOf(clock);
    const prev = st.current.last;
    st.current.last = beat;
    const crossed = (b: number) => prev < b && beat >= b;
    const { shot, t } = shotFor(stage, Math.max(0, beat));
    if (home.current) home.current.visible = false;
    if (rival.current) rival.current.visible = false;
    st.current.shake = Math.max(0, st.current.shake - dt * 2.2);

    st.current.amp = 1;
    let lens = BASE_FOV;
    if (shot.kind === "rev") {
      // Burnout, seen from the side on a long lens: the car waits on the main
      // street facing the exit, the rear wheel spins up in its own smoke and
      // the body shakes; then it launches to the left of the frame, trailing
      // smoke, and the camera travels with it. The camera looks west, so the
      // sky and the open lots are behind the car, and south is screen left.
      const zPark = revZ;
      const x = -LANE;
      // Facing south (rotation 0), local (x, z) is world (x, z); the east-side rear wheel faces the camera.
      const wheel = WHEELS[2];
      const wx = x + wheel.x * M_TO_UNIT;
      const out = 1;
      const u = Math.max(0, t - REV_LAUNCH);
      const zCar = zPark + 0.5 * REV_ACCEL * u * u;
      const wz = zCar + wheel.z * M_TO_UNIT;
      if (t < REV_LAUNCH) {
        const k = t / REV_LAUNCH;
        pose(
          home.current,
          homeWheels.current,
          x,
          zPark,
          0,
          dt,
          25 + 170 * k * k,
          0.05 * Math.sin(t * 70) * (0.4 + k),
          0.025 * k,
          0,
        );
        bursts.current?.burst(wx, 0.5, wz - 0.9, {
          count: 1,
          speed: 1 + 1.5 * k,
          colors: SMOKE,
          size: 0.28 + 0.27 * k,
          life: 1.0,
          gravity: -1.5,
          flat: 0.6,
        });
        st.current.shake = Math.max(st.current.shake, 0.06 + 0.12 * k);
      } else {
        const speed = REV_ACCEL * u;
        pose(
          home.current,
          homeWheels.current,
          x,
          zCar,
          speed,
          dt,
          speed + 60,
          0,
          -0.04 * Math.max(0, 1 - u * 3),
          0,
        );
        // The smoke trails the wheel as it goes.
        if (u < 0.6)
          bursts.current?.burst(wx, 0.5, wz - 0.9, {
            count: 1,
            speed: 2,
            colors: SMOKE,
            size: 0.45,
            life: 0.8,
            gravity: -1.5,
            flat: 0.6,
          });
        if (u < 0.3) st.current.shake = Math.max(st.current.shake, 0.5 * (1 - u / 0.3));
      }
      // From across the street: the wheel low in the frame, a strip of road
      // under it. After the launch the camera travels with the car, a little
      // slower, pulling back and widening, so it runs off to the left.
      const chase = smooth(Math.min(1, u / 0.35));
      const zRest = zPark + wheel.z * M_TO_UNIT;
      const zCam = zRest - 0.6 + (zCar - zPark) * 0.8;
      _pos.set(wx + out * (REV_DIST + 3 * chase), 1.3 + 1.5 * chase, zCam);
      _look.set(wx, 1.7 + 0.8 * chase, zCam + 0.6);
      lens = REV_FOV + (REV_WIDE - REV_FOV) * chase;
      st.current.amp = 0.22;
    } else if (shot.kind === "arrival") {
      const z = gateZ + ARRIVAL_SPEED * (CROSS - t);
      pose(home.current, homeWheels.current, LANE, z, ARRIVAL_SPEED, dt);
      // Low behind the car, pushing in a little, the arch and the town above it.
      const back = 30 - 6 * smooth(Math.min(1, t / 1.4));
      _pos.set(LANE - 5, 6.5, z + back);
      _look.set(LANE, 9, z - 70);
    } else if (shot.kind === "aerial") {
      // Slow orbit, the two towns turned toward each other across the split.
      const a = (stage === "claude" ? -0.75 : 0.75) + (stage === "claude" ? 1 : -1) * 0.05 * t;
      const r = width * 0.92;
      _look.set(0, 25, cityZ);
      _pos.set(Math.sin(a) * r, r * 0.62, cityZ + Math.cos(a) * r);
    } else if (shot.kind === "invasion" && run) {
      const z = run.zs[0] + LOT * 0.9 - INVADE_SPEED * t;
      pose(rival.current, rivalWheels.current, run.x, z, INVADE_SPEED, dt);
      if (beat >= shot.start) {
        smash(run.x, z, 3.2, 2, 220, false);
        for (const b of BLASTS) {
          if (b < shot.start || b >= shot.end || !crossed(b)) continue;
          smash(run.x, z - 6, 20, 3, 0, true);
          bursts.current?.burst(run.x, 6, z - 6, {
            count: 40,
            speed: 46,
            colors: FIRE,
            size: 2.6,
            life: 0.9,
          });
        }
      }
      // From across the main street, level with the car, so the columns fall in frame.
      _pos.set(run.x + side * 88, 20, z + 34);
      _look.set(run.x, 22, z - 18);
    } else if (shot.kind === "finale" && run && tower !== undefined) {
      const tz = run.zs[run.zs.length - 1];
      const hitAt = (COLLAPSE - shot.start) * BEAT;
      const z = tz + 24 + INVADE_SPEED * Math.max(0, hitAt - t);
      pose(rival.current, rivalWheels.current, run.x, z, t < hitAt ? INVADE_SPEED : 0, dt);
      if (crossed(COLLAPSE)) {
        st.current.shake = 1.4;
        const target = store.targets[tower];
        bursts.current?.burst(target.x, 8, target.z + target.d / 2, {
          count: 90,
          speed: 55,
          colors: FIRE,
          size: 3,
          life: 1.2,
        });
      }
      // Implosion: floor after floor off the bottom, the tower sinking into its own dust.
      if (beat >= COLLAPSE && store.standing(tower) > 0) {
        const target = store.targets[tower];
        const due = Math.floor(((beat - COLLAPSE) * BEAT) / FLOOR_EVERY);
        const cols = store.rowsOf(tower).map((_, c) => c);
        let taken = target.floors - Math.max(...store.rowsOf(tower));
        while (taken < due && store.standing(tower) > 0) {
          store.hitColumns(tower, cols, 1, Date.now(), attacker);
          taken++;
          bursts.current?.burst(target.x, 2, target.z, {
            count: 10,
            speed: 30,
            colors: DEBRIS,
            size: 2.4,
            life: 1.2,
          });
        }
        st.current.shake = Math.max(st.current.shake, 0.4);
      }
      // Low on the street, looking up at the tower; creeps in.
      const push = smooth(Math.min(1, t / 2.4));
      _pos.set(run.x + side * (150 - 30 * push), 7, tz + 190 - 50 * push);
      _look.set(run.x, 70 - 30 * push, tz);
    } else return;

    const k = st.current.shake;
    if (k > 0) {
      const n = performance.now() / 1000;
      _pos.x += Math.sin(n * 71) * 1.6 * k * st.current.amp;
      _pos.y += Math.cos(n * 53) * 1.2 * k * st.current.amp;
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
      <group ref={home} visible={false}>
        <Suspense fallback={null}>
          <CarModel color={homeColor} wheelRefs={homeWheels} />
        </Suspense>
      </group>
      <group ref={rival} visible={false}>
        <Suspense fallback={null}>
          <CarModel color={rivalColor} wheelRefs={rivalWheels} />
        </Suspense>
      </group>
      <Bursts ref={bursts} />
    </>
  );
}
