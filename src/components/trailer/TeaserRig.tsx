"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CarModel from "@/components/league/drive/CarModel";
import { Bursts, FIRE, Missile, type VoxelBursts } from "@/components/league/drive/Voxels";
import { M_TO_UNIT, TURBO, WHEEL } from "@/lib/league-city/drive/tuning";
import { WHEELS } from "@/lib/league-city/drive/vehicle";
import { LANE } from "@/lib/league-city/intro";
import { RAMP_BIG } from "@/lib/league-city/ramp";
import type { SmashStore } from "@/lib/league-city/smash";
import {
  BEAT,
  DRIFT_ARC,
  DRIFT_IN,
  REV_LAUNCH,
  MISSILE_HIT,
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
/** Rev: how hard the car launches (units/s²). */
/** The long lens on the wheel from across the street, and how wide it opens for the launch. */
const REV_DIST = 24;
const REV_FOV = 11;
const REV_WIDE = 30;
const BASE_FOV = 50;
const REV_ACCEL = 150;
const SMOKE = ["#d9d6de", "#bdb9c4", "#ece9ef", "#a7a2b0"];
/** Drift: corner radius and speed (units). */
const DRIFT_R = 30;
const DRIFT_SPEED = 55;
/** Jump take: the big ramp on Claude's avenue (world z), the boosted speed, when the car reaches the ramp's foot (s), gravity. */
const RAMP_Z = -11 * LOT;
const JUMP_SPEED = 95;
const JUMP_FOOT = 0.45;
const JUMP_G = 55;
/** Missile take: both cars' speed, and the flip (launch speed, gravity, time in the air). */
const MISSILE_SPEED = 48;
const FLIP_UP = 30;
const FLIP_G = 70;
const FLIP_AIR = 0.85;
/** Implosion: one floor off every column this often (s). */
const FLOOR_EVERY = 0.045;

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * The drift path at t: up the main street (x0, north), round a corner of
 * DRIFT_R (dir 1 right, −1 left), then down the cross street. `slip` is how
 * far the tail swings out; `v` is the progress round the corner (0 to 1).
 */
function driftAt(t: number, x0: number, zTurn: number, dir: number) {
  const arcEnd = DRIFT_IN + DRIFT_ARC;
  let x: number, z: number, heading: number;
  if (t < DRIFT_IN) {
    x = x0;
    z = zTurn + DRIFT_SPEED * (DRIFT_IN - t);
    heading = Math.PI;
  } else if (t < arcEnd) {
    const phi = ((t - DRIFT_IN) / DRIFT_ARC) * (Math.PI / 2);
    x = x0 + dir * (DRIFT_R - DRIFT_R * Math.cos(phi));
    z = zTurn - DRIFT_R * Math.sin(phi);
    heading = Math.PI - dir * phi;
  } else {
    x = x0 + dir * (DRIFT_R + DRIFT_SPEED * (t - arcEnd));
    z = zTurn - DRIFT_R;
    heading = Math.PI - (dir * Math.PI) / 2;
  }
  const v = (t - DRIFT_IN) / DRIFT_ARC;
  const slip =
    0.75 *
    smooth(Math.min(1, Math.max(0, v / 0.22))) *
    (1 - smooth(Math.min(1, Math.max(0, (v - 0.85) / 0.45))));
  return { x, z, heading, slip, v };
}

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
  const missile = useRef<THREE.Group>(null);
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
    // Particles only while the film moves: a paused frame stays as it is.
    const fx = beat !== prev ? bursts.current : null;
    const { shot, t } = shotFor(stage, Math.max(0, beat));
    if (home.current) home.current.visible = false;
    if (rival.current) rival.current.visible = false;
    if (missile.current) missile.current.visible = false;
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
        fx?.burst(wx, 0.5, wz - 0.9, {
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
          fx?.burst(wx, 0.5, wz - 0.9, {
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
    } else if (shot.kind === "drift" || shot.kind === "topdrift") {
      // Round a corner sideways: the car comes up the main street, throws the
      // tail out and slides through the turn in its own smoke, the
      // mini-turbo sparks going blue, orange, purple, then straightens out
      // down the cross street. "drift": a right turn at the first cross
      // street, the camera low on the outside of the corner. "topdrift": a
      // left turn further up, from the game's top-down camera.
      const top = shot.kind === "topdrift";
      const dir = top ? -1 : 1;
      const zTurn = (top ? -7 : -3) * LOT - 12;
      const x0 = LANE;
      const p = driftAt(t, x0, zTurn, dir);
      const yaw = p.heading - dir * p.slip;
      pose(home.current, homeWheels.current, p.x, p.z, DRIFT_SPEED, dt, DRIFT_SPEED, 0, 0, yaw);
      if (home.current) home.current.rotation.z = -0.05 * dir * p.slip;
      if (p.slip > 0.15) {
        const colors = [TURBO.colors[p.v < 0.35 ? 1 : p.v < 0.7 ? 2 : 3]];
        for (const w of [WHEELS[2], WHEELS[3]]) {
          const lx = w.x * M_TO_UNIT;
          const lz = w.z * M_TO_UNIT;
          const px = p.x + lx * Math.cos(yaw) + lz * Math.sin(yaw);
          const pz = p.z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
          fx?.burst(px, 0.6, pz, {
            count: 1,
            speed: 2.5,
            colors: SMOKE,
            size: (top ? 1.3 : 0.7) + 0.5 * p.slip,
            life: 1.1,
            gravity: -1.2,
            flat: 0.6,
          });
          fx?.burst(px, 0.4, pz, {
            count: 1,
            speed: 4,
            colors,
            size: top ? 0.8 : 0.35,
            life: 0.22,
            gravity: 20,
          });
        }
        st.current.shake = Math.max(st.current.shake, 0.12);
      }
      if (top) {
        // High above and a little behind, turning with the car's heading (the drive's top camera, closer in).
        const fxz = Math.sin(p.heading);
        const fzz = Math.cos(p.heading);
        _pos.set(p.x - fxz * 16, 68, p.z - fzz * 16);
        _look.set(p.x + fxz * 6, 0, p.z + fzz * 6);
        lens = 46;
        st.current.amp = 0.2;
      } else {
        // Low on the outside of the corner, close in, on a medium lens; it
        // drifts a little toward the exit and the aim follows the car.
        const drift = smooth(Math.min(1, t / 1.6));
        _pos.set(x0 - 6 + 10 * drift, 1.7, zTurn - DRIFT_R - 12 + 4 * drift);
        _look.set(p.x, 2.8, p.z);
        lens = 36;
        st.current.amp = 0.4;
      }
    } else if (shot.kind === "jump") {
      // Down the avenue on a boost, up the big ramp and into the sky toward
      // the giant mascot, seen from low beside the ramp's lip: the car
      // crosses the frame right to left against the sky.
      const lip = RAMP_Z - RAMP_BIG.length / 2;
      const foot = RAMP_Z + RAMP_BIG.length / 2;
      const zAt = (tt: number) => foot + JUMP_SPEED * (JUMP_FOOT - tt);
      const z = zAt(t);
      let y = 0;
      let pitch = 0;
      const slope = RAMP_BIG.height / RAMP_BIG.length;
      if (z <= foot && z > lip) {
        y = (foot - z) * slope;
        pitch = -Math.atan(slope);
      } else if (z <= lip) {
        const tl = JUMP_FOOT + RAMP_BIG.length / JUMP_SPEED;
        const air = t - tl;
        const vy = JUMP_SPEED * slope;
        y = Math.max(0, RAMP_BIG.height + vy * air - 0.5 * JUMP_G * air * air);
        pitch = -Math.atan((vy - JUMP_G * air) / JUMP_SPEED) * 0.8;
      }
      pose(home.current, homeWheels.current, 0, z, JUMP_SPEED, dt, JUMP_SPEED, y, pitch);
      // The boost flame behind it.
      fx?.burst(0, y + 1.2, z + 5, {
        count: 2,
        speed: 3,
        colors: [TURBO.colors[1], "#ffffff", TURBO.colors[2]],
        size: 0.9,
        life: 0.35,
        gravity: 0,
      });
      // Low beside the lip, looking up and across; the aim follows the car a little.
      _pos.set(-58, 2.5, lip - 6);
      _look.set(0, 12 + y * 0.6, lip - 12 - (lip - z) * 0.6);
      lens = 34;
      st.current.amp = 0.3;
    } else if (shot.kind === "missile") {
      // The blue car fires on the orange one up the street: a missile with a
      // smoke tail, a fireball on the hit, and the orange car flips through
      // the air. The camera rides behind and beside the shooter.
      const z0 = revZ + 60;
      const zo = z0 - MISSILE_SPEED * t;
      const zb = zo + 22;
      const xo = LANE;
      const xb = -5;
      const fire = 1 * BEAT;
      const hit = MISSILE_HIT * BEAT;
      pose(home.current, homeWheels.current, xb, zb, MISSILE_SPEED, dt);
      if (t < fire) pose(rival.current, rivalWheels.current, xo, zo, MISSILE_SPEED, dt);
      if (t >= fire && t < hit && missile.current) {
        const u = (t - fire) / (hit - fire);
        const sx = xb,
          sz = zb - 5,
          sy = 2.2;
        const mx = sx + (xo - sx) * u;
        const mz = sz + (zo - sz) * u;
        const my = sy + 1.5 * Math.sin(Math.PI * u);
        missile.current.visible = true;
        missile.current.position.set(mx, my, mz);
        missile.current.lookAt(xo, 1.5, zo);
        fx?.burst(mx, my, mz + 1.5, {
          count: 2,
          speed: 2,
          colors: SMOKE,
          size: 0.9,
          life: 0.7,
          gravity: -2,
        });
      }
      if (t < hit) {
        if (t >= fire) pose(rival.current, rivalWheels.current, xo, zo, MISSILE_SPEED, dt);
      } else {
        // Blown up and over: up, forward, tumbling, down on its roof.
        const u = t - hit;
        const zHit = z0 - MISSILE_SPEED * hit;
        const air = Math.min(u, FLIP_AIR);
        const y = Math.max(0, FLIP_UP * air - 0.5 * FLIP_G * air * air);
        const zf =
          zHit -
          MISSILE_SPEED * 0.6 * air -
          12 * Math.max(0, u - FLIP_AIR) * Math.exp(-(u - FLIP_AIR) * 3);
        pose(rival.current, rivalWheels.current, xo + 4 * air, zf, 0, dt, 30, y);
        if (rival.current) {
          const spin = Math.min(u, FLIP_AIR) / FLIP_AIR;
          rival.current.rotation.set(-Math.PI * spin, Math.PI + 0.6 * spin, 0.9 * spin);
        }
        if (crossed(shot.start + MISSILE_HIT)) {
          fx?.burst(xo, 2, zHit, {
            count: 70,
            speed: 40,
            colors: FIRE,
            size: 2.4,
            life: 1.0,
          });
          fx?.burst(xo, 2, zHit, {
            count: 25,
            speed: 18,
            colors: ["#2a2a30", "#3a3a44"],
            size: 2.8,
            life: 1.6,
            gravity: -6,
          });
          st.current.shake = 1.2;
        }
        if (u < 1.2)
          fx?.burst(xo + 4 * air, y + 1.5, zf, {
            count: 1,
            speed: 3,
            colors: ["#2a2a30", "#4a4a54"],
            size: 1.4,
            life: 1,
            gravity: -5,
          });
      }
      // Low, behind and right of the shooter, moving with both cars.
      const zCam = zb + 12;
      _pos.set(xb + 9, 3, zCam);
      _look.set(1, 2.2, zo + 4);
      lens = 44;
      st.current.amp = 0.5;
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
          smash(run.x, z - 6, 24, 7, 0, true);
          fx?.burst(run.x, 6, z - 6, {
            count: 40,
            speed: 46,
            colors: FIRE,
            size: 2.6,
            life: 0.9,
          });
        }
      }
      // A wide, still frame from across the main street at an angle to the
      // first building: the car comes in, rams its base, the bomb goes off
      // and the floors blow out. It creeps in a little.
      const b0 = run.zs[0];
      const push = smooth(Math.min(1, t / 1.6));
      _pos.set(run.x - 112 + 12 * push, 12, b0 + 26 - 6 * push);
      _look.set(run.x, 30, b0 - 10);
      lens = 42;
    } else if (shot.kind === "finale" && run && tower !== undefined) {
      const tz = run.zs[run.zs.length - 1];
      const hitAt = (COLLAPSE - shot.start) * BEAT;
      const z = tz + 24 + INVADE_SPEED * Math.max(0, hitAt - t);
      pose(rival.current, rivalWheels.current, run.x, z, t < hitAt ? INVADE_SPEED : 0, dt);
      if (crossed(COLLAPSE)) {
        st.current.shake = 1.4;
        const target = store.targets[tower];
        fx?.burst(target.x, 8, target.z + target.d / 2, {
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
          fx?.burst(target.x, 2, target.z, {
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
      <group ref={missile} visible={false}>
        <Missile />
      </group>
      <Bursts ref={bursts} />
    </>
  );
}
