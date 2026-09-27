"use client";

import "@/lib/silenceThreeClockWarning";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { THEMES, ThemeLights, type CityTheme } from "@/components/city/theme";
import type { DriveCameraMode } from "@/lib/league-city/drive/telemetry";
import { HUD_BOX } from "@/components/league/hud/shared";
import { isDesktop } from "@/components/towns/useDesktop";
import DriftHud from "@/components/drift/DriftHud";
import DriftTitle, { DriftLoading } from "@/components/drift/DriftTitle";
import DriftResults, { type PostResult, type PostState } from "@/components/drift/DriftResults";
import type { DriftFinish } from "@/components/drift/DriftWorld";
import { carColor } from "@/lib/league-city/drive/net";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { GhostRun } from "@/lib/league-city/race/ghost";
import { pointAt } from "@/lib/league-city/race/track";
import { TRIAL, type TrialStage } from "@/lib/league-city/race/trial";
import type { Frames } from "@/lib/drift/frames";
import { loadRun, saveRun, type LocalRun } from "@/lib/drift/local";
import { courseOf, getLiveSpot } from "@/lib/drift/spots";
import type { LiveSpot, SpotId } from "@/lib/drift/spots/types";
import { createDriftTelemetry } from "@/lib/drift/telemetry";

// A drift spot: one Canvas, the world (DriftWorld, client only), the HUD and
// the results. The title card, a flyover the first time, 3-2-1, the run, the
// results. Runs post when you're signed in; signed out, your best stays in
// this browser and posts once you sign in.

const DriftWorld = dynamic(() => import("@/components/drift/DriftWorld"), { ssr: false, loading: () => null });

const MUTE_KEY = "gc:drive-muted";

// The race track's clear afternoon: blue sky, warm sun, soft fill, no fog to speak of.
const DAY: CityTheme = {
  ...THEMES[0],
  sky: [
    [0, "#2f7fd6"],
    [0.35, "#6fb2ec"],
    [0.5, "#cfe7f8"],
    [0.52, "#e8f3fb"],
    [1, "#e8f3fb"],
  ],
  fogColor: "#cfe7f8",
  fogNear: 900,
  fogFar: 4500,
  ambientColor: "#ffffff",
  ambientIntensity: 0.55,
  sunColor: "#fff1d6",
  sunIntensity: 0.95,
  sunPos: [300, 400, 200],
  fillColor: "#bcd8ff",
  fillIntensity: 0.3,
  fillPos: [-200, 150, -200],
  hemiSky: "#cfe7ff",
  hemiGround: "#5d8a45",
  hemiIntensity: 0.35,
};

const toGhost = (frames: Frames, splits: number[]): GhostRun => ({ ms: frames[frames.length - 4] ?? 0, splits, frames });

export default function SpotClient({
  spotId,
  viewerLogin,
  boardScores,
  myBest,
  record,
  rivalLogin,
  challenger,
}: {
  spotId: SpotId;
  viewerLogin: string | null;
  boardScores: number[];
  myBest: number | null;
  record: { login: string; score: number } | null;
  rivalLogin: string | null;
  challenger: string | null;
}) {
  const spot = getLiveSpot(spotId) as LiveSpot;
  const course = useMemo(() => courseOf(spot), [spot]);
  const router = useRouter();
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setDesktop(isDesktop());
    check();
  }, []);

  const [telemetry] = useState(createDriftTelemetry);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [camera, setCamera] = useState<DriveCameraMode>("chase");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showGhosts, setShowGhosts] = useState(true);
  const [trial, setTrial] = useState<{ stage: TrialStage; at: number; beat: number }>({ stage: "menu", at: 0, beat: TRIAL.beatMs });
  const goStage = useCallback((stage: TrialStage, beat?: number) => {
    setTrial((t) => (t.stage === stage && stage !== "countdown" ? t : { stage, at: performance.now(), beat: beat ?? t.beat }));
  }, []);
  const restartRef = useRef<(() => void) | null>(null);
  const respawnRef = useRef<(() => void) | null>(null);

  // Your best: the board's, or this browser's when better (a run not posted yet).
  const [local, setLocal] = useState<LocalRun | null>(null);
  useEffect(() => {
    const read = () => setLocal(loadRun(spot.id));
    read();
  }, [spot.id]);
  const [serverBest, setServerBest] = useState(myBest);
  const best = [serverBest, local?.score ?? null].reduce<number | null>((a, b) => (b === null ? a : a === null ? b : Math.max(a, b)), null);
  const pb = useMemo(() => (local ? toGhost(local.frames, local.splits) : null), [local]);

  // The ghost to race.
  const [rivalName, setRivalName] = useState(rivalLogin);
  const [rival, setRival] = useState<{ login: string; run: GhostRun; color: string } | null>(null);
  useEffect(() => {
    if (!rivalName) return;
    let live = true;
    fetch(`/api/drift/${spot.id}/ghost?login=${encodeURIComponent(rivalName)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ login: string; frames: Frames; splits: number[] }>) : null))
      .then((g) => {
        if (live && g) setRival({ login: g.login, run: toGhost(g.frames, g.splits), color: carColor(g.login) });
      })
      .catch(() => {
        // offline: your own ghost only
      });
    return () => {
      live = false;
    };
  }, [rivalName, spot.id]);

  useEffect(() => {
    const read = () => {
      try {
        setMuted(localStorage.getItem(MUTE_KEY) === "1");
      } catch {
        // storage blocked: sound stays on
      }
    };
    read();
  }, []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        // storage blocked
      }
      return !m;
    });
  }, []);
  const toggleCamera = useCallback(() => setCamera((c) => (c === "chase" ? "top" : "chase")), []);
  const toggleGhosts = useCallback(() => setShowGhosts((g) => !g), []);

  const [leaving, setLeaving] = useState(false);
  const exit = useCallback(() => {
    setLeaving(true);
    router.push(`/drift?spot=${spot.id}`);
  }, [router, spot.id]);

  // Title → countdown: the 3-2-1 is the camera coming down onto the car (one shot, no flyover).
  const begin = useCallback(() => goStage("countdown", TRIAL.beatMs), [goStage]);
  useEffect(() => {
    if (!ready || paused) return;
    if (trial.stage === "menu") {
      const go = (e: KeyboardEvent) => {
        if ((e.code === "Enter" || e.code === "Space") && !e.repeat) begin();
      };
      window.addEventListener("keydown", go);
      return () => window.removeEventListener("keydown", go);
    }
    if (trial.stage === "intro") {
      const skip = (e: KeyboardEvent) => {
        if (e.key !== "Escape" && !e.repeat) goStage("countdown", TRIAL.beatMs);
      };
      window.addEventListener("keydown", skip);
      const t = setTimeout(() => goStage("countdown", TRIAL.beatMs), TRIAL.introMs);
      return () => {
        window.removeEventListener("keydown", skip);
        clearTimeout(t);
      };
    }
  }, [ready, paused, trial.stage, goStage, begin]);

  // Esc pauses and resumes; Q on the pause menu leaves for the spots. On the title, Esc goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (leaving) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (trial.stage === "menu") exit();
        else setPaused((v) => !v);
      } else if (e.code === "KeyQ" && paused) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, exit, leaving, trial.stage]);

  // Posting a run.
  const [finish, setFinish] = useState<{ run: DriftFinish; before: number | null } | null>(null);
  const [post, setPost] = useState<PostState>({ status: "posting" });
  const send = useCallback(
    async (run: { frames: Frames; score: number; splits: number[] }) => {
      if (!viewerLogin) return setPost({ status: "signed-out" });
      setPost({ status: "posting" });
      try {
        const res = await fetch(`/api/drift/${spot.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frames: run.frames, score: run.score }),
        });
        if (!res.ok) return setPost({ status: "failed" });
        const result = (await res.json()) as PostResult;
        setServerBest(result.best);
        const mine = loadRun(spot.id);
        if (mine && mine.score <= result.best) saveRun(spot.id, { ...mine, posted: true });
        setPost({ status: "posted", result });
      } catch {
        setPost({ status: "failed" });
      }
    },
    [viewerLogin, spot.id],
  );
  const onFinish = useCallback(
    (run: DriftFinish) => {
      setFinish({ run, before: best });
      const mine = loadRun(spot.id);
      if (!mine || run.score > mine.score) {
        const next = { score: run.score, frames: run.frames, splits: run.splits, posted: false };
        saveRun(spot.id, next);
        setLocal(next);
      }
      void send(run);
    },
    [best, spot.id, send],
  );
  // Signed in with a better run from before signing in: post it once.
  const postedOld = useRef(false);
  useEffect(() => {
    if (!viewerLogin || !local || local.posted || postedOld.current) return;
    if (serverBest !== null && local.score <= serverBest) return;
    postedOld.current = true;
    void fetch(`/api/drift/${spot.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames: local.frames, score: local.score }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<PostResult>) : null))
      .then((result) => {
        if (!result) return;
        setServerBest(result.best);
        saveRun(spot.id, { ...local, posted: true });
      })
      .catch(() => {
        // offline: tries again next visit
      });
  }, [viewerLogin, local, serverBest, spot.id]);

  const retry = useCallback(() => {
    setFinish(null);
    setPaused(false);
    restartRef.current?.();
  }, []);
  const raceGhost = useCallback(
    (login: string) => {
      setRivalName(login);
      retry();
    },
    [retry],
  );

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  const start = pointAt(course.track, course.track.closed ? -30 : 0);
  const look = pointAt(course.track, 20);

  if (desktop === false) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center font-pixel uppercase">
        <p className="text-xs text-cream">Drift needs a keyboard or a gamepad for now.</p>
        <p className="text-[10px] normal-case text-muted">Open it on a computer to drift.</p>
        <button type="button" onClick={exit} className="btn-press border-2 border-lime px-4 py-2 text-[11px] text-lime">
          Back to spots
        </button>
      </div>
    );
  }

  return (
    <>
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        camera={{ position: [(start.x - start.tx * 10) * M_TO_UNIT, 40, (start.z - start.tz * 10) * M_TO_UNIT], fov: 60, near: 2, far: 8000 }}
        onCreated={({ camera: c }) => c.lookAt(look.x * M_TO_UNIT, 0, look.z * M_TO_UNIT)}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
      >
        <fog attach="fog" args={[DAY.fogColor, DAY.fogNear, DAY.fogFar]} />
        <ThemeLights theme={DAY} themeIndex={21} />
        {desktop && !failed && (
          <DriftWorld
            spot={spot}
            course={course}
            title={spot.name}
            color={carColor(viewerLogin ?? "guest")}
            telemetry={telemetry}
            camera={camera}
            onCameraToggle={toggleCamera}
            muted={muted || leaving}
            paused={paused || leaving}
            stage={trial.stage}
            stageAt={trial.at}
            beatMs={trial.beat}
            onStage={goStage}
            pb={pb}
            rival={rival}
            showGhosts={showGhosts}
            onFinish={onFinish}
            restartRef={restartRef}
            respawnRef={respawnRef}
            onReady={onReady}
            onFail={onFail}
          />
        )}
      </Canvas>

      {ready && trial.stage === "menu" && (
        <DriftTitle spot={spot} best={best} record={record} rival={rival?.login ?? null} challenger={challenger} onStart={begin} onSpots={exit} />
      )}

      {!failed && <DriftLoading spot={spot} ready={ready} />}
      {failed && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg font-pixel text-xs uppercase text-cream">
          Something broke loading {spot.name}.
          <button type="button" onClick={exit} className={`${HUD_BOX} px-4 py-2 text-lime`}>
            Back to spots
          </button>
        </div>
      )}

      <DriftHud
        spot={spot}
        telemetry={telemetry}
        ready={ready}
        stage={trial.stage}
        paused={paused}
        muted={muted}
        showGhosts={showGhosts}
        best={best}
        boardScores={boardScores}
        onToggleGhosts={toggleGhosts}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onPause={setPaused}
        onRestart={retry}
        onRespawn={() => respawnRef.current?.()}
        onExit={exit}
      />

      {trial.stage === "finish" && finish && (
        <DriftResults
          spot={spot}
          score={finish.run.score}
          before={finish.before}
          stats={finish.run.stats}
          post={post}
          you={viewerLogin}
          onRetry={retry}
          onRetryPost={() => void send(finish.run)}
          onRaceGhost={raceGhost}
          onSpots={exit}
        />
      )}
    </>
  );
}
