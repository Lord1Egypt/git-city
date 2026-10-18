"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import posthog from "posthog-js";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import TrackScene from "@/components/race/TrackScene";
import { Billboard } from "@/components/league/identity/IdentityPieces";
import { useFontReady } from "@/components/league/identity/IdentityLayer";
import DriftHud, { fmt } from "@/components/drift/DriftHud";
import DriftResults, { type PostResult, type PostState } from "@/components/drift/DriftResults";
import type { DriftFinish } from "@/components/drift/DriftWorld";
import type { BoardRowLite } from "@/components/drift/DriftTitle";
import TouchControls from "@/components/league/hud/drive/TouchControls";
import { LOT, lotToWorld } from "@/lib/league-city/grid";
import type { DriveCameraMode } from "@/lib/league-city/drive/telemetry";
import type { TouchDrive } from "@/lib/league-city/drive/touch";
import { carColor } from "@/lib/league-city/drive/net";
import type { GhostRun } from "@/lib/league-city/race/ghost";
import { TRIAL, type TrialStage } from "@/lib/league-city/race/trial";
import type { Frames } from "@/lib/drift/frames";
import { loadRun, saveRun, type LocalRun } from "@/lib/drift/local";
import { courseOf, getLiveSpot } from "@/lib/drift/spots";
import type { LiveSpot } from "@/lib/drift/spots/types";
import { createDriftTelemetry } from "@/lib/drift/telemetry";
import { DRIFT_SIGN_LOT, DRIFT_SITE } from "@/lib/towns/brasil-drift";

// The Brasil town's drift track (Pista Brasil), out on the land between São
// Paulo and Rio. From the town it's a circuit painted on the ground: the
// asphalt and its line under the START gantry, no walls yet, and a DRIFT
// sign by the gate with the track's top five. Driving across the line swaps
// the town's car for a drift run right there, as on /drift: 3-2-1, the
// scorer, the HUD, Enter for the last checkpoint, the finish and the board.
// Then again, or back to the city at the gate.

const DriftWorld = dynamic(() => import("@/components/drift/DriftWorld"), { ssr: false, loading: () => null });

export const BRASIL_DRIFT = getLiveSpot("brasil-harbor") as LiveSpot;
const COURSE = courseOf(BRASIL_DRIFT);
/** The site's ground: the shore's green, a shade off the open country, so the track reads as a place. */
const SITE_GREEN = "#1d4a2e";
const LIME = "#c8e64a";
const unlit = { current: 0 };
/** Seen from farther than this (units), the site isn't drawn. */
const SITE_VIEW = 9000;

/** A patch of ground under the whole site (lots). */
export function SiteGround() {
  const x0 = (DRIFT_SITE.x0 - 0.5) * LOT;
  const x1 = (DRIFT_SITE.x1 + 0.5) * LOT;
  const z0 = (DRIFT_SITE.z0 - 0.5) * LOT;
  const z1 = (DRIFT_SITE.z1 + 0.5) * LOT;
  return (
    <mesh position={[(x0 + x1) / 2, -0.5, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial color={SITE_GREEN} emissive={SITE_GREEN} emissiveIntensity={0.2} roughness={1} />
    </mesh>
  );
}

/** A billboard face: lime on the night panel, like the cities' signs. */
function signTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, 256, 128);
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function drawSign(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "56px Silkscreen, monospace";
  ctx.fillStyle = LIME;
  ctx.fillText("DRIFT", 128, 52);
  ctx.font = "16px Silkscreen, monospace";
  ctx.fillStyle = "#8a93a6";
  ctx.fillText("CRUZE O START", 128, 100);
}

function drawTop(ctx: CanvasRenderingContext2D, board: BoardRowLite[]) {
  const top = board.slice(0, 5);
  ctx.textBaseline = "middle";
  ctx.font = "14px Silkscreen, monospace";
  ctx.fillStyle = LIME;
  ctx.fillText("TOP 5 · PISTA BRASIL", 12, 16);
  if (top.length === 0) {
    ctx.fillStyle = "#8a93a6";
    ctx.fillText("NINGUÉM AINDA", 12, 60);
  }
  top.forEach((r, i) => {
    const y = 38 + i * 20;
    ctx.fillStyle = i === 0 ? LIME : "#e8e4d8";
    ctx.textAlign = "left";
    let login = `${r.rank} @${r.login}`;
    while (ctx.measureText(login).width > 160 && login.length > 4) login = `${login.slice(0, -2)}…`;
    ctx.fillText(login, 12, y);
    ctx.textAlign = "right";
    ctx.fillText(fmt(r.score), 244, y);
  });
}

/** The track as the town sees it: ground, asphalt and the START gantry, the DRIFT sign and the top five. */
export function DriftSite({ board }: { board: BoardRowLite[] }) {
  const group = useRef<THREE.Group>(null);
  const [sx, sz] = lotToWorld(...DRIFT_SIGN_LOT);
  useFrame(({ camera }) => {
    const g = group.current;
    if (g) g.visible = Math.hypot(camera.position.x - sx, camera.position.y, camera.position.z - sz) < SITE_VIEW;
  });
  // fontReady: drawn again once Silkscreen is in.
  const fontReady = useFontReady();
  const sign = useMemo(() => {
    void fontReady;
    return signTexture(drawSign);
  }, [fontReady]);
  const tower = useMemo(() => {
    void fontReady;
    return signTexture((ctx) => drawTop(ctx, board));
  }, [fontReady, board]);
  useEffect(() => () => sign.dispose(), [sign]);
  useEffect(() => () => tower.dispose(), [tower]);
  return (
    <group ref={group}>
      <SiteGround />
      <TrackScene track={COURSE.track} lit={unlit} title="Drift" grass={false} stands={false} trees={false} walls={false} />
      <Billboard position={[sx - 18, sz]} rot={0} map={sign} />
      <Billboard position={[sx + 18, sz]} rot={0} map={tower} />
    </group>
  );
}

const toGhost = (frames: Frames, splits: number[]): GhostRun => ({ ms: frames[frames.length - 4] ?? 0, splits, frames });

/**
 * A drift run on the town's track: the world for the Canvas and the HUD over
 * it. `active` mounts both; `onBack` is "back to the city" (or a load that
 * failed). Runs post to the track's board when you're signed in.
 */
export function useBrasilDrift({
  active,
  viewerLogin,
  townPath,
  camera,
  onCameraToggle,
  muted,
  onToggleMute,
  touch,
  onBack,
}: {
  active: boolean;
  viewerLogin: string | null;
  townPath: string;
  camera: DriveCameraMode;
  onCameraToggle: () => void;
  muted: boolean;
  onToggleMute: () => void;
  touch: React.MutableRefObject<TouchDrive> | null;
  onBack: () => void;
}) {
  const spot = BRASIL_DRIFT;
  const [telemetry] = useState(createDriftTelemetry);
  const [ready, setReady] = useState(false);
  const [paused, setPausedRaw] = useState(false);
  const [showGhosts, setShowGhosts] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const respawnRef = useRef<(() => void) | null>(null);
  const [trial, setTrial] = useState<{ stage: TrialStage; at: number; beat: number }>({ stage: "menu", at: 0, beat: TRIAL.beatMs });
  const goStage = useCallback((stage: TrialStage, beat?: number) => {
    setTrial((t) => (t.stage === stage && stage !== "countdown" ? t : { stage, at: performance.now(), beat: beat ?? t.beat }));
  }, []);
  const stageNow = useRef(trial.stage);
  useEffect(() => {
    stageNow.current = trial.stage;
  }, [trial.stage]);
  // Paused in the middle of 3-2-1, the countdown starts over on the way back.
  const setPaused = useCallback(
    (on: boolean | ((v: boolean) => boolean)) => {
      setPausedRaw((v) => {
        const next = typeof on === "function" ? on(v) : on;
        if (v && !next && stageNow.current === "countdown") setTimeout(() => goStage("countdown", TRIAL.beatMs), 0);
        return next;
      });
    },
    [goStage],
  );

  // The board: the sign's top five, the results' rows, your best.
  const [board, setBoard] = useState<BoardRowLite[]>([]);
  const [serverBest, setServerBest] = useState<number | null>(null);
  const loadBoard = useCallback(() => {
    fetch(`/api/drift/${spot.id}/board`)
      .then((r) => (r.ok ? (r.json() as Promise<{ rows: BoardRowLite[]; me: { score: number } | null }>) : null))
      .then((b) => {
        if (!b) return;
        setBoard(b.rows.map((r) => ({ rank: r.rank, login: r.login, score: r.score })));
        setServerBest(b.me?.score ?? null);
      })
      .catch(() => {
        // offline: the sign stays empty
      });
  }, [spot.id]);
  useEffect(loadBoard, [loadBoard]);
  const [local, setLocal] = useState<LocalRun | null>(null);
  useEffect(() => {
    const read = () => setLocal(loadRun(spot.id));
    read();
  }, [spot.id]);
  const best = [serverBest, local?.score ?? null].reduce<number | null>((a, b) => (b === null ? a : a === null ? b : Math.max(a, b)), null);
  const pb = useMemo(() => (local ? toGhost(local.frames, local.splits) : null), [local]);

  // The ghost to race: the driver just above you, from the results.
  const [rival, setRival] = useState<{ login: string; run: GhostRun; color: string; score: number } | null>(null);
  const raceGhost = useRef<(login: string) => void>(() => {});

  const [finish, setFinish] = useState<{ run: DriftFinish; before: number | null } | null>(null);
  const [post, setPost] = useState<PostState>({ status: "posting" });

  // Starting: a fresh world on the grid, 3-2-1 as soon as it's in.
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) {
      Object.assign(telemetry, { drift: null, feed: [], split: null, countdown: null, carScreen: null });
      const t = setTimeout(() => {
        setReady(false);
        setPausedRaw(false);
        setFinish(null);
        setRunKey((k) => k + 1);
        setTrial({ stage: "menu", at: performance.now(), beat: TRIAL.beatMs });
      }, 0);
      posthog.capture("brasil_drift_started", { signed_in: !!viewerLogin });
      wasActive.current = active;
      return () => clearTimeout(t);
    }
    wasActive.current = active;
  }, [active, telemetry, viewerLogin]);
  useEffect(() => {
    if (!active || !ready || trial.stage !== "menu") return;
    const t = setTimeout(() => goStage("countdown", TRIAL.beatMs), 400);
    return () => clearTimeout(t);
  }, [active, ready, trial.stage, goStage]);

  const send = useCallback(
    async (run: { frames: Frames; score: number }) => {
      if (!viewerLogin) return setPost({ status: "signed-out" });
      setPost({ status: "posting" });
      const failed = () => {
        const mine = loadRun(spot.id);
        if (mine && mine.score === run.score) saveRun(spot.id, { ...mine, posted: false });
        setPost({ status: "failed" });
      };
      try {
        const res = await fetch(`/api/drift/${spot.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frames: run.frames, score: run.score }),
        });
        if (!res.ok) return failed();
        const result = (await res.json()) as PostResult;
        setServerBest(result.best);
        const mine = loadRun(spot.id);
        if (mine && mine.score <= result.best) saveRun(spot.id, { ...mine, posted: true });
        setPost({ status: "posted", result });
        loadBoard();
      } catch {
        failed();
      }
    },
    [viewerLogin, spot.id, loadBoard],
  );
  const onFinish = useCallback(
    (run: DriftFinish) => {
      setFinish({ run, before: best });
      posthog.capture("brasil_drift_finished", { score: run.score, best: best ?? null, signed_in: !!viewerLogin });
      const mine = loadRun(spot.id);
      if (!mine || run.score > mine.score) {
        const next = { score: run.score, frames: run.frames, splits: run.splits, posted: !!viewerLogin };
        saveRun(spot.id, next);
        setLocal(next);
      }
      void send(run);
    },
    [best, spot.id, send, viewerLogin],
  );

  const retry = useCallback(() => {
    setFinish(null);
    setPaused(false);
    Object.assign(telemetry, { drift: null, feed: [], split: null, countdown: null, carScreen: null });
    setRunKey((k) => k + 1);
    goStage("countdown", TRIAL.beatMs);
  }, [telemetry, goStage, setPaused]);
  useEffect(() => {
    raceGhost.current = (login: string) => {
      fetch(`/api/drift/${spot.id}/ghost?login=${encodeURIComponent(login)}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ login: string; score: number; frames: Frames; splits: number[] }>) : null))
        .then((g) => {
          if (g) setRival({ login: g.login, run: toGhost(g.frames, g.splits), color: carColor(g.login), score: g.score });
        })
        .catch(() => {
          // offline: your own ghost only
        })
        .finally(retry);
    };
  }, [spot.id, retry]);

  const back = useCallback(() => {
    posthog.capture("brasil_drift_exit", { stage: stageNow.current });
    setPaused(false);
    setFinish(null);
    onBack();
  }, [onBack, setPaused]);

  // Esc pauses and resumes (the results take Esc themselves: back to the city).
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stageNow.current === "finish") return;
      e.preventDefault();
      setPaused((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, setPaused]);

  const onReady = useCallback(() => setReady(true), []);
  const toggleGhosts = useCallback(() => setShowGhosts((g) => !g), []);
  const ground = useMemo(() => <SiteGround />, []);

  const world = active ? (
    <DriftWorld
      key={runKey}
      spot={spot}
      course={COURSE}
      title={spot.name}
      color={carColor(viewerLogin ?? "guest")}
      telemetry={telemetry}
      camera={camera}
      onCameraToggle={onCameraToggle}
      muted={muted}
      paused={paused}
      stage={trial.stage}
      stageAt={trial.at}
      beatMs={trial.beat}
      onStage={goStage}
      pb={pb}
      rival={rival}
      showGhosts={showGhosts}
      onFinish={onFinish}
      onRestart={retry}
      respawnRef={respawnRef}
      onReady={onReady}
      onFail={onBack}
      touch={touch ?? undefined}
      ground={ground}
    />
  ) : null;

  const overlay = active ? (
    <>
      {touch && ready && (trial.stage === "countdown" || trial.stage === "run") && !paused && (
        <div className="pointer-events-none fixed inset-0 z-20 font-pixel uppercase">
          <TouchControls touchRef={touch} telemetry={telemetry} mode="drift" />
        </div>
      )}
      <DriftHud
        touch={!!touch}
        spot={spot}
        telemetry={telemetry}
        ready={ready}
        stage={trial.stage}
        paused={paused}
        muted={muted}
        showGhosts={showGhosts}
        best={best}
        boardScores={board.map((r) => r.score)}
        rival={rival}
        onToggleGhosts={toggleGhosts}
        onToggleMute={onToggleMute}
        onToggleCamera={onCameraToggle}
        onPause={setPaused}
        onRestart={retry}
        onRespawn={() => respawnRef.current?.()}
        onExit={back}
        exitLabel="Voltar à cidade"
      />
      {trial.stage === "finish" && finish && (
        <DriftResults
          spot={spot}
          score={finish.run.score}
          before={finish.before}
          stats={finish.run.stats}
          board={board}
          post={post}
          you={viewerLogin}
          onRetry={retry}
          onRetryPost={() => void send(finish.run)}
          onRaceGhost={(login) => raceGhost.current(login)}
          onSpots={back}
          town={{ again: "Dirigir de novo", exit: "Voltar à cidade", path: townPath }}
        />
      )}
    </>
  ) : null;

  return { world, overlay, board };
}
