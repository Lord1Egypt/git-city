"use client";

import "@/lib/silenceThreeClockWarning";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { THEMES, ThemeLights, type CityTheme } from "@/components/city/theme";
import type { DriveCameraMode } from "@/lib/league-city/drive/telemetry";
import { HUD_BOX } from "@/components/league/hud/shared";
import { isDesktop, isTouch } from "@/components/towns/useDesktop";
import TouchControls from "@/components/league/hud/drive/TouchControls";
import { createTouch, type TouchDrive } from "@/lib/league-city/drive/touch";
import DriftHud from "@/components/drift/DriftHud";
import DriftTitle, { DriftLoading, type BoardRowLite } from "@/components/drift/DriftTitle";
import DriftResults, { type PostResult, type PostState } from "@/components/drift/DriftResults";
import type { DriftFinish } from "@/components/drift/DriftWorld";
import LiveDrivers from "@/components/drift/LiveDrivers";
import type { CarApi } from "@/components/league/drive/Car";
import { carColor, guestName } from "@/lib/league-city/drive/net";
import { M_TO_UNIT } from "@/lib/league-city/drive/tuning";
import type { GhostRun } from "@/lib/league-city/race/ghost";
import { pointAt } from "@/lib/league-city/race/track";
import { TRIAL, type TrialStage } from "@/lib/league-city/race/trial";
import type { Frames } from "@/lib/drift/frames";
import { loadRun, saveRun, type LocalRun } from "@/lib/drift/local";
import { courseOf, getLiveSpot } from "@/lib/drift/spots";
import type { LiveSpot, SpotId } from "@/lib/drift/spots/types";
import { createDriftTelemetry } from "@/lib/drift/telemetry";
import { SERIES, slotOf, standings, type ClientSeriesMsg, type Series } from "@/lib/drift/series";
import { roomId } from "@/lib/drift/ticket";
import { RoomLobby, RoomResults, RoomStandings } from "@/components/drift/RoomScreens";

// A drift spot: one Canvas, the world (DriftWorld, client only), the HUD and
// the results. The title card, a flyover the first time, 3-2-1, the run, the
// results. Runs post when you're signed in; signed out, your best stays in
// this browser and posts once you sign in.
//
// In a room with friends (`room`), the room runs the show: its lobby instead
// of the title, everyone's 3-2-1 on the room's clock, the room's results
// after the line (the run still posts to the board). R puts you back on the
// last checkpoint instead of starting over.

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
  board,
  myBest,
  rivalLogin,
  challenger,
  raceNow = false,
  room,
}: {
  /** A room with friends: its code, your seat, and how to follow it to another spot. */
  room?: { code: string; seat: string; onSpot: (spot: SpotId) => void };
  spotId: SpotId;
  viewerLogin: string | null;
  boardScores: number[];
  board: BoardRowLite[];
  myBest: number | null;
  rivalLogin: string | null;
  challenger: string | null;
  /** Came from "race this ghost" (?ghost=): skip the title, straight into 3-2-1 once the ghost is in. */
  raceNow?: boolean;
}) {
  const spot = getLiveSpot(spotId) as LiveSpot;
  const course = useMemo(() => courseOf(spot), [spot]);
  const router = useRouter();
  // What drives the car here, known only in the browser (null until then, so neither screen flashes):
  // keys or a pad on a computer, the touch controls on a phone or tablet, or neither.
  const [device, setDevice] = useState<"desktop" | "touch" | "none" | null>(null);
  useEffect(() => {
    const check = () => setDevice(isTouch() ? "touch" : isDesktop() ? "desktop" : "none");
    check();
  }, []);
  const desktop = device === "desktop";

  const [telemetry] = useState(createDriftTelemetry);
  // Phones: the town drive's touch controls, drift mode (a held DRIFT, no auto drift).
  const touch = device === "touch";
  const touchRef = useRef<TouchDrive>(createTouch());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [camera, setCamera] = useState<DriveCameraMode>("chase");
  const [paused, setPausedRaw] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showGhosts, setShowGhosts] = useState(true);
  const [trial, setTrial] = useState<{ stage: TrialStage; at: number; beat: number }>({ stage: "menu", at: 0, beat: TRIAL.beatMs });
  const goStage = useCallback((stage: TrialStage, beat?: number) => {
    setTrial((t) => (t.stage === stage && stage !== "countdown" ? t : { stage, at: performance.now(), beat: beat ?? t.beat }));
  }, []);
  // Pause and resume. Paused in the middle of 3-2-1, the countdown starts over on the way back, not under the menu.
  const stageNow = useRef(trial.stage);
  useEffect(() => {
    stageNow.current = trial.stage;
  }, [trial.stage]);
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
  // Bumped on every restart: the world remounts from scratch (car, physics, camera, score).
  const [runKey, setRunKey] = useState(0);
  const respawnRef = useRef<(() => void) | null>(null);
  // Your car for the spot's live room: everyone here sees everyone else as a ghost.
  const liveCar = useRef<CarApi | null>(null);
  const [guest] = useState(() => guestName());

  // The room with friends: its series, the server's clock against ours, a way to talk to it.
  const [series, setSeries] = useState<Series | null>(null);
  const [denied, setDenied] = useState<"seat" | "full" | null>(null);
  const clockOffset = useRef(0);
  const roomSend = useRef<((msg: ClientSeriesMsg) => void) | null>(null);
  const onRoomMsg = useCallback((msg: { t: string } & Record<string, unknown>) => {
    if (msg.t === "series") {
      clockOffset.current = (msg.now as number) - Date.now();
      setSeries(msg.series as Series);
    } else if (msg.t === "denied") setDenied(msg.reason as "seat" | "full");
  }, []);
  const me = viewerLogin ?? "";
  const inGrid = !!series?.grid.some((e) => e.login.toLowerCase() === me.toLowerCase());
  // Your place on the grid, set as each run lines up (the world remounts there): nobody starts on top of anyone.
  const [slot, setSlot] = useState(0);

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
  const [rival, setRival] = useState<{ login: string; run: GhostRun; color: string; score: number } | null>(null);
  // The ghost asked for has come in, or won't (none, or offline): the run can start.
  const [rivalSettled, setRivalSettled] = useState(!rivalLogin);
  useEffect(() => {
    if (!rivalName) return;
    let live = true;
    fetch(`/api/drift/${spot.id}/ghost?login=${encodeURIComponent(rivalName)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ login: string; score: number; frames: Frames; splits: number[] }>) : null))
      .then((g) => {
        if (live && g) setRival({ login: g.login, run: toGhost(g.frames, g.splits), color: carColor(g.login), score: g.score });
      })
      .catch(() => {
        // offline: your own ghost only
      })
      .finally(() => {
        if (live) setRivalSettled(true);
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
    router.push(room ? "/drift" : `/drift?spot=${spot.id}`);
  }, [router, spot.id, room]);

  // Title → countdown: the 3-2-1 is the camera coming down onto the car (one shot, no flyover).
  const begin = useCallback(() => goStage("countdown", TRIAL.beatMs), [goStage]);
  // "Race this ghost" from a board: no title, the countdown starts as soon as the world and the ghost are in.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!raceNow || autoStarted.current || !ready || !rivalSettled || trial.stage !== "menu") return;
    autoStarted.current = true;
    const t = setTimeout(begin, 300);
    return () => clearTimeout(t);
  }, [raceNow, ready, rivalSettled, trial.stage, begin]);
  useEffect(() => {
    if (!ready || paused) return;
    if (trial.stage === "menu" && !room) {
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
  }, [ready, paused, trial.stage, goStage, begin, room]);

  // Esc pauses and resumes; Q on the pause menu leaves for the spots. On the title, Esc goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (leaving) return;
      if (e.key === "Escape") {
        e.preventDefault();
        // The room's screens take Esc themselves (leave).
        if (trial.stage === "menu") {
          if (!room) exit();
        } else if (trial.stage !== "finish") setPaused((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, exit, leaving, trial.stage, setPaused, room]);

  // Posting a run.
  const [finish, setFinish] = useState<{ run: DriftFinish; before: number | null } | null>(null);
  const [post, setPost] = useState<PostState>({ status: "posting" });
  const send = useCallback(
    async (run: { frames: Frames; score: number; splits: number[] }) => {
      if (!viewerLogin) return setPost({ status: "signed-out" });
      setPost({ status: "posting" });
      // Didn't reach the board: kept as not posted, so a later visit posts it.
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
      } catch {
        failed();
      }
    },
    [viewerLogin, spot.id],
  );
  const postedOld = useRef(false);
  const onFinish = useCallback(
    (run: DriftFinish) => {
      setFinish({ run, before: best });
      const mine = loadRun(spot.id);
      if (!mine || run.score > mine.score) {
        // Signed in, it posts right below (send): only a signed-out run waits to be posted later.
        const next = { score: run.score, frames: run.frames, splits: run.splits, posted: !!viewerLogin };
        saveRun(spot.id, next);
        setLocal(next);
      }
      void send(run);
      roomSend.current?.({ t: "run", frames: run.frames, score: run.score });
    },
    [best, spot.id, send, viewerLogin],
  );
  // Signed in with a better run from before signing in: post it once.
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

  // Start the whole run over: a new world, the HUD cleared, the full 3-2-1.
  const retry = useCallback(() => {
    setFinish(null);
    setPaused(false);
    Object.assign(telemetry, { drift: null, feed: [], split: null, countdown: null, carScreen: null });
    setRunKey((k) => k + 1);
    goStage("countdown", TRIAL.beatMs);
  }, [telemetry, goStage, setPaused]);
  const raceGhost = useCallback(
    (login: string) => {
      setRivalName(login);
      retry();
    },
    [retry],
  );

  // The room's turns. A run starting: the world from scratch on the line, the 3-2-1 on the
  // room's clock so everyone sees GO together. The room moved to another spot: follow it
  // (the page mounts that spot). Time up before your line: your results. A rematch: the lobby.
  const roundOn = useRef(0);
  useEffect(() => {
    if (!room || !series) return;
    const follow = () => {
      if (series.spot !== spot.id) return room.onSpot(series.spot);
      if (series.phase === "countdown" && inGrid && roundOn.current !== series.round) {
        roundOn.current = series.round;
        setSlot(slotOf(series, me));
        setFinish(null);
        setPaused(false);
        Object.assign(telemetry, { drift: null, feed: [], split: null, countdown: null, carScreen: null });
        setRunKey((k) => k + 1);
        const startsIn = series.goAt - SERIES.countdownMs - (Date.now() + clockOffset.current);
        setTrial({ stage: "countdown", at: performance.now() + startsIn, beat: TRIAL.beatMs });
      } else if (series.phase === "lobby" && (stageNow.current === "finish" || stageNow.current === "run")) {
        roundOn.current = 0;
        setFinish(null);
        setRunKey((k) => k + 1);
        goStage("menu");
      } else if ((series.phase === "results" || series.phase === "final") && stageNow.current === "run") goStage("finish");
    };
    follow();
  }, [room, series, spot.id, inGrid, telemetry, goStage, setPaused, me]);

  // The room in PostHog, once each per driver: in the room, each run's outcome, the series'.
  const logged = useRef({ joined: false, run: 0, series: false });
  useEffect(() => {
    if (!room || !series) return;
    const l = logged.current;
    const drivers = series.players.filter((p) => p.online).length;
    const host = series.host?.toLowerCase() === me.toLowerCase();
    if (!l.joined) {
      l.joined = true;
      posthog.capture("drift_room_joined", { code: room.code, drivers, host, round: series.round });
    }
    const mine = series.grid.findIndex((e) => e.login.toLowerCase() === me.toLowerCase());
    if ((series.phase === "results" || series.phase === "final") && mine >= 0 && l.run !== series.round) {
      l.run = series.round;
      const e = series.grid[mine];
      posthog.capture("drift_room_run_ended", {
        code: room.code,
        round: series.round,
        spot: series.spot,
        drivers: series.grid.length,
        place: e.score === null ? null : mine + 1,
        points: e.gained,
        score: e.score,
        host,
      });
    }
    if (series.phase === "final" && !l.series) {
      l.series = true;
      const table = standings(series);
      const at = table.findIndex((p) => p.login.toLowerCase() === me.toLowerCase());
      if (at >= 0) posthog.capture("drift_room_series_ended", { code: room.code, drivers: table.length, place: at + 1, points: table[at].points, won: at === 0, host });
    }
    // A rematch is a new series.
    if (series.phase === "lobby" && series.round === 0) Object.assign(l, { run: 0, series: false });
  }, [room, series, me]);

  // Your score for the room's standings, twice a second through the run.
  useEffect(() => {
    if (!room || trial.stage !== "run") return;
    const t = setInterval(() => roomSend.current?.({ t: "live", score: telemetry.drift?.score ?? 0 }), 500);
    return () => clearInterval(t);
  }, [room, trial.stage, telemetry]);

  const respawnNow = useCallback(() => respawnRef.current?.(), []);
  const roomActions = {
    onSpot: (id: SpotId) => roomSend.current?.({ t: "spot", spot: id }),
    onStart: () => roomSend.current?.({ t: "start" }),
    onFinal: () => roomSend.current?.({ t: "final" }),
    onRematch: () => roomSend.current?.({ t: "rematch" }),
    onLeave: exit,
  };

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  const start = pointAt(course.track, course.track.closed ? -30 : 0);
  const look = pointAt(course.track, 20);

  if (device === "none") {
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
        {(desktop || touch) && !failed && (
          <DriftWorld
            key={runKey}
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
            pb={room ? null : pb}
            rival={rival}
            slot={slot}
            showGhosts={showGhosts}
            onFinish={onFinish}
            onRestart={room ? respawnNow : retry}
            respawnRef={respawnRef}
            onReady={onReady}
            onFail={onFail}
            touch={touch ? touchRef : undefined}
            carOutRef={liveCar}
          />
        )}
        {(desktop || touch) && !failed && <LiveDrivers
            room={room ? roomId(room.code) : spot.id}
            name={viewerLogin ?? guest}
            car={liveCar}
            show={showGhosts}
            seat={room?.seat}
            onMessage={room ? onRoomMsg : undefined}
            sendRef={room ? roomSend : undefined}
          />}
      </Canvas>

      {room && ready && trial.stage === "menu" && series && <RoomLobby series={series} spot={spot} code={room.code} you={me} {...roomActions} />}
      {room && denied && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg px-6 text-center font-pixel text-xs uppercase text-cream">
          {denied === "full" ? `This room is full (${SERIES.maxPlayers} drivers).` : "Sign in with GitHub to join this room."}
          <button type="button" onClick={exit} className={`${HUD_BOX} px-4 py-2 text-lime`}>
            Back to spots
          </button>
        </div>
      )}
      {!room && ready && trial.stage === "menu" && !raceNow && (
        <DriftTitle spot={spot} best={best} board={board} you={viewerLogin} rival={rival?.login ?? null} challenger={challenger} onStart={begin} onSpots={exit} />
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

      {touch && ready && (trial.stage === "countdown" || trial.stage === "run") && !paused && (
        <div className="pointer-events-none fixed inset-0 z-20 font-pixel uppercase">
          <TouchControls touchRef={touchRef} telemetry={telemetry} mode="drift" />
        </div>
      )}
      <DriftHud
        touch={touch}
        spot={spot}
        telemetry={telemetry}
        ready={ready}
        stage={trial.stage}
        paused={paused}
        muted={muted}
        showGhosts={showGhosts}
        best={best}
        boardScores={boardScores}
        rival={rival}
        onToggleGhosts={toggleGhosts}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onPause={setPaused}
        onRestart={room ? respawnNow : retry}
        onRespawn={() => respawnRef.current?.()}
        onExit={exit}
        room={room && series && inGrid ? <RoomStandings series={series} you={me} /> : undefined}
      />

      {room && trial.stage === "finish" && series && <RoomResults series={series} spot={spot} you={me} {...roomActions} />}
      {!room && trial.stage === "finish" && finish && (
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
          onRaceGhost={raceGhost}
          onSpots={exit}
        />
      )}
    </>
  );
}
