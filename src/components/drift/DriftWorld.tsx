"use client";

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import Car, { type CarApi } from "@/components/league/drive/Car";
import Lights from "@/components/league/drive/Lights";
import { Smoke } from "@/components/league/drive/Particles";
import SkidMarks from "@/components/league/drive/SkidMarks";
import { CameraKey, DriveAudio, LocalFx } from "@/components/league/drive/carFx";
import type { FxSource } from "@/components/league/drive/fx";
import { useDriveInput } from "@/components/league/drive/useDriveInput";
import RaceCamera, { type RaceCameraMode, type RaceShot } from "@/components/race/RaceCamera";
import TrackScene from "@/components/race/TrackScene";
import { Ghost } from "@/components/race/Ghost";
import type { Spawn } from "@/lib/league-city/drive/spawn";
import { GRAVITY, M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import { carHeading, placeCar } from "@/lib/league-city/drive/vehicle";
import { autopilot, type AutopilotState } from "@/lib/league-city/race/autopilot";
import type { GhostRun } from "@/lib/league-city/race/ghost";
import { wallSegments } from "@/lib/league-city/race/layout";
import { sfx } from "@/lib/league-city/race/sfx";
import { trackSurface } from "@/lib/league-city/race/surface";
import { countdownBeat, TRIAL, type TrialStage } from "@/lib/league-city/race/trial";
import type { Track } from "@/lib/league-city/race/track";
import { FrameRecorder, TICK_MS, type Frame, type Frames } from "@/lib/drift/frames";
import { Scorer, respawnPose, type Course } from "@/lib/drift/score";
import type { LiveSpot } from "@/lib/drift/spots/types";
import type { DriftTelemetry } from "@/lib/drift/telemetry";

// A drift spot's world: the walls, your car in drift mode, the ghosts, and
// the run. The run records the car's pose on exact ticks (frames.ts) and
// steps the scorer with every tick, so the HUD shows the very score the
// server will check. Stages come from the page, like the race's time trial:
// the car waits on the grid through the title and the flyover, is held
// through 3-2-1, runs from GO to the finish, and then drives itself.
// R starts over from the grid; Enter puts you back on the last checkpoint
// you passed (the drift at risk is lost).

export interface DriftFinish {
  frames: Frames;
  score: number;
  splits: number[];
}

export interface DriftWorldProps {
  spot: LiveSpot;
  course: Course;
  title: string;
  color: string;
  telemetry: DriftTelemetry;
  camera: RaceCameraMode;
  onCameraToggle: () => void;
  muted: boolean;
  paused: boolean;
  stage: TrialStage;
  stageAt: number;
  beatMs: number;
  onStage: (stage: TrialStage, beatMs?: number) => void;
  /** The results are up: the camera keeps the car to the left. */
  frameLeft: boolean;
  /** Your best run here, and the other ghost you race (someone's best, their login). */
  pb: GhostRun | null;
  rival: { login: string; run: GhostRun; color: string } | null;
  showGhosts: boolean;
  onFinish: (run: DriftFinish) => void;
  /** The HUD's Restart button calls this (R does the same). */
  restartRef: React.MutableRefObject<(() => void) | null>;
  /** The HUD's Respawn button calls this (Enter does the same). */
  respawnRef: React.MutableRefObject<(() => void) | null>;
  onReady: () => void;
  onFail: () => void;
}

const U = M_TO_UNIT;
const NONE: never[] = [];
const SHOTS: Record<TrialStage, RaceShot> = { menu: "title", intro: "intro", countdown: "follow", run: "follow", finish: "tv" };

class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[drift]", err);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

const rotOf = (heading: number) => ((Math.PI - heading) * 180) / Math.PI;

function Walls({ track }: { track: Track }) {
  const segs = useMemo(() => wallSegments(track), [track]);
  const h = track.spec.wallHeight / 2;
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[2000, 1, 2000]} position={[0, -1, 0]} friction={0.6} />
      {segs.map((w) => (
        <CuboidCollider
          key={`${w.side}:${w.i}:${w.x}`}
          args={[track.spec.wallThickness / 2, h, w.len / 2]}
          position={[w.x, h, w.z]}
          rotation={[0, w.rotY, 0]}
          friction={0.1}
          restitution={0.2}
        />
      ))}
    </RigidBody>
  );
}

const _v = new THREE.Vector3();

type InputRef = ReturnType<typeof useDriveInput>;
/** Overrides what the driver's hands say this frame (the countdown holds the car, the finish drives it). */
function override(input: InputRef, patch: Partial<InputRef["current"]["input"]>) {
  input.current.input = { ...input.current.input, ...patch };
}

export default function DriftWorld({
  spot,
  course,
  title,
  color,
  telemetry,
  camera,
  onCameraToggle,
  muted,
  paused,
  stage,
  stageAt,
  beatMs,
  onStage,
  frameLeft,
  pb,
  rival,
  showGhosts,
  onFinish,
  restartRef,
  respawnRef,
  onReady,
  onFail,
}: DriftWorldProps) {
  const track = course.track;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const surface = useMemo(() => trackSurface(track, spot.surface), [track, spot.surface]);
  const spawn = useMemo<Spawn>(() => {
    const g = track.grid[0];
    return { x: g.x * U, z: g.z * U, rot: rotOf(g.heading) };
  }, [track]);

  const input = useDriveInput(paused || stage === "menu" || stage === "intro" || stage === "finish");
  const car = useRef<CarApi | null>(null);
  const impact = useRef({ strength: 0, at: 0 });
  const fx = useRef(new Map<string, FxSource>());
  const lit = useRef(0);
  const pilot = useRef<AutopilotState>({ s: null });
  const recorder = useRef(new FrameRecorder());
  const scorer = useRef<Scorer | null>(null);
  // Date.now() at GO, for the ghosts (they play on the wall clock).
  const runStart = useRef<number | null>(null);
  const finished = useRef(false);
  const count = useRef({ at: 0, beat: -1 });

  const stageRef = useRef({ stage, at: stageAt, beat: beatMs });
  useEffect(() => {
    stageRef.current = { stage, at: stageAt, beat: beatMs };
  }, [stage, stageAt, beatMs]);
  const cb = useRef({ onStage, onFinish });
  useEffect(() => {
    cb.current = { onStage, onFinish };
  });
  const tel = useRef(telemetry);
  useEffect(() => {
    tel.current = telemetry;
  }, [telemetry]);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  const say = useCallback((play: () => void) => {
    if (!mutedRef.current && !document.hidden) play();
  }, []);
  const pbRef = useRef(pb);
  useEffect(() => {
    pbRef.current = pb;
  }, [pb]);
  const rivalRun = useRef<GhostRun | null>(rival?.run ?? null);
  useEffect(() => {
    rivalRun.current = rival?.run ?? null;
  }, [rival]);
  const ghostsOn = useRef(showGhosts);
  useEffect(() => {
    ghostsOn.current = showGhosts;
  }, [showGhosts]);

  /** Clears the run: no recording, no score, the HUD blank. */
  const clearRun = useCallback(() => {
    recorder.current.stop();
    scorer.current = null;
    runStart.current = null;
    finished.current = false;
    Object.assign(tel.current, { drift: null, feed: [], split: null });
  }, []);

  const toGrid = useCallback(() => {
    const c = car.current;
    if (!c) return;
    const g = track.grid[0];
    placeCar(c.body, g.x, g.z, g.heading);
    Object.assign(c.state, { drifting: false, spinLeft: 0, recovering: 0, driftAngle: 0 });
  }, [track]);

  // R (Car calls onReset after putting the car on the grid), or the HUD button: a fresh run.
  const onReset = useCallback(() => {
    clearRun();
    const st = stageRef.current.stage;
    if (st !== "menu" && st !== "intro") cb.current.onStage("countdown", TRIAL.retryBeatMs);
  }, [clearRun]);
  useEffect(() => {
    restartRef.current = () => {
      toGrid();
      onReset();
    };
    return () => void (restartRef.current = null);
  }, [restartRef, toGrid, onReset]);

  /** One tick into the scorer: the HUD's numbers, the feed, the splits, the finish. */
  const stepRef = useRef<(f: Frame) => void>(() => {});
  useEffect(() => {
    stepRef.current = (f: Frame) => {
      const sc = scorer.current;
      if (!sc || finished.current) return;
      const hud = tel.current;
      const before = sc.state.splits.length;
      const st = sc.step(f);
      hud.drift = st;
      const now = performance.now();
      for (const e of st.events) {
        hud.feed = [{ kind: e.kind, points: e.points, at: now }, ...hud.feed].slice(0, 4);
        if (e.kind === "bank" && e.points >= 1000) say(() => sfx.chime(true));
        if (e.kind === "lost") say(() => sfx.chime(false));
      }
      const ref = rivalRun.current ?? pbRef.current;
      if (st.splits.length > before && ref) {
        const k = st.splits.length - 1;
        const theirs = ref.splits[k];
        if (theirs !== undefined) hud.split = { delta: st.splits[k] - theirs, at: now };
      }
      if (st.finished) {
        finished.current = true;
        recorder.current.stop();
        say(sfx.finish);
        pilot.current = { s: null };
        const frames = recorder.current.all().slice(0, (st.t / TICK_MS + 1) * 4);
        cb.current.onStage("finish");
        cb.current.onFinish({ frames, score: st.score, splits: [...st.splits] });
      }
      };
  });

  /** Back on the last checkpoint passed, facing down the track. */
  const respawn = useCallback(() => {
    const c = car.current;
    const sc = scorer.current;
    if (!c || !sc || stageRef.current.stage !== "run" || finished.current) return;
    const pose = respawnPose(track, Math.max(0, sc.checkpoint - 1));
    placeCar(c.body, pose.x, pose.z, pose.heading);
    Object.assign(c.state, { drifting: false, spinLeft: 0, recovering: 0, driftAngle: 0 });
    for (const f of recorder.current.snap(performance.now(), pose.x, pose.z, pose.heading)) stepRef.current(f);
  }, [track]);
  useEffect(() => {
    respawnRef.current = respawn;
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Enter" || e.code === "NumpadEnter") && !e.repeat) respawn();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      respawnRef.current = null;
    };
  }, [respawn, respawnRef]);

  const three = useThree();
  useFrame(() => {
    const c = car.current;
    const hud = tel.current;
    if (!c) return;
    const now = performance.now();
    const sg = stageRef.current;
    hud.countdown = null;

    if (sg.stage === "countdown") {
      // 3-2-1-GO: the car is held; at GO the run starts from where it stands.
      const cd = count.current;
      if (cd.at !== sg.at) Object.assign(cd, { at: sg.at, beat: -1 });
      const beat = countdownBeat(now - sg.at, sg.beat);
      override(input, { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false });
      hud.countdown = beat;
      lit.current = beat > 0 ? 6 - beat : 0;
      if (beat !== cd.beat) {
        cd.beat = beat;
        if (beat > 0) say(sfx.beep);
      }
      if (beat === 0) {
        say(sfx.go);
        hud.goAt = now;
        const p = c.body.translation();
        clearRun();
        scorer.current = new Scorer(course);
        runStart.current = Date.now();
        stepRef.current(recorder.current.begin(now, p.x, p.z, carHeading(c.body)));
        cb.current.onStage("run");
      }
    }

    // Past the finish the car drives itself (a run just slows to a stop).
    if (sg.stage === "finish") {
      const p0 = c.body.translation();
      override(
        input,
        track.closed
          ? autopilot(track, pilot.current, p0.x, p0.z, carHeading(c.body), c.state.speed)
          : { throttle: 0, brake: 1, steer: 0, handbrake: false },
      );
    }

    if (sg.stage === "run" && recorder.current.running) {
      const p = c.body.translation();
      for (const f of recorder.current.push(now, p.x, p.z, carHeading(c.body))) stepRef.current(f);
    }

    // Where the car is on screen, for the combo next to it.
    const p = c.body.translation();
    _v.set(p.x * U, 1.5 * U, p.z * U).project(three.camera);
    hud.carScreen = { x: ((_v.x + 1) / 2) * three.size.width, y: ((1 - _v.y) / 2) * three.size.height };
  });

  const ghostClock = useCallback(() => runStart.current, []);
  const zero = useCallback(() => 0, []);
  const pbShow = useCallback(() => ghostsOn.current && stageRef.current.stage === "run", []);

  return (
    <Boundary onFail={onFail}>
      <TrackScene track={track} lit={lit} title={title} />
      <Suspense fallback={null}>
        <Physics timeStep={1 / 60} interpolate paused={hidden || paused} gravity={[0, GRAVITY, 0]} updatePriority={-50}>
          <Walls track={track} />
          <Car
            spawn={spawn}
            objects={NONE}
            buildings={NONE}
            h={0}
            input={input}
            telemetry={telemetry}
            apiRef={car}
            color={color}
            impact={impact}
            surface={surface}
            onReset={onReset}
            turbo
            driftMode
          >
            <Lights braking={() => !!car.current?.state.braking} />
          </Car>
          <LocalFx car={car} sources={fx} />
          <SkidMarks sources={fx} />
          <Smoke sources={fx} />
          <DriveAudio car={car} input={input} impact={impact} muted={muted || paused} />
          <Ghost run={pbRef} lapStart={ghostClock} offset={zero} show={pbShow} />
          {rival && <Ghost run={rivalRun} lapStart={ghostClock} offset={zero} show={pbShow} color={rival.color} label={`@${rival.login}`} />}
          <RaceCamera mode={camera} car={car} track={track} shot={SHOTS[stage]} shotAt={stageAt} frameLeft={frameLeft} />
          <CameraKey input={input} onToggle={onCameraToggle} />
          <Ready onReady={onReady} />
        </Physics>
      </Suspense>
    </Boundary>
  );
}
