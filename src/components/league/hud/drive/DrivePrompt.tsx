"use client";

import { useEffect, useRef, useState } from "react";
import type { DriveTelemetry } from "@/lib/league-city/drive/telemetry";
import { DRIFT } from "@/lib/league-city/drive/tuning";
import { ITEM_NAMES, isItem } from "@/lib/league-city/drive/battle";

// Teaches the car one move at a time, at the moment it's useful, the way
// racers do it (Forza's "hold to accelerate", Crash Team Racing's power slide
// prompt at the first corner, Burnout's "hold to boost" when the meter fills):
//   drive   W / ↑ while the car still rolls (first drive, from the intro);
//           grows and pulses if you wait
//   steer   A D a beat later, if you haven't steered yet (first drive)
//   boost   Shift, once you're moving fast in a straight line
//   drift   Space + steer, once you turn at speed
//   attack  F, when you pick up something from a ? box
//   camera  C, after a while on the road
// Each one goes the moment you do it. Boost, drift, attack and camera are remembered
// once done (every drive teaches what you haven't done yet); an ignored one
// comes back later. A gamepad counts as driving once the car speeds up.

type Lesson = "drive" | "steer" | "boost" | "drift" | "attack" | "camera";
const REMEMBERED = new Set<Lesson>(["boost", "drift", "attack", "camera"]);

const THROTTLE = new Set(["KeyW", "ArrowUp"]);
const STEER = new Set(["KeyA", "KeyD", "ArrowLeft", "ArrowRight"]);
const LEARNED_KEY = "gc:drive-learned";
/** Waiting this long on the drive prompt makes it insist. */
const IDLE_MS = 4000;
/** After you drive, the steer prompt waits this long for you to steer on your own. */
const STEER_DELAY_MS = 1200;
/** A prompt nobody acts on goes away after this long, and comes back after COOLDOWN_MS. */
const SHOW_MS: Record<Lesson, number> = { drive: Infinity, steer: 5000, boost: 7000, drift: 7000, attack: 9000, camera: 6000 };
const COOLDOWN_MS = 25000;
/** Quiet time between two prompts. */
const GAP_MS = 1500;
/** Faster than the car rolls at the handoff (m/s): someone is on the throttle. */
const DRIVING_SPEED = 9;
/** Boost: this fast (m/s), straight, for BOOST_AFTER_MS. */
const BOOST_SPEED = 10;
const BOOST_AFTER_MS = 1000;
/** Drift: steering above this speed (m/s) for DRIFT_AFTER_MS. */
const DRIFT_SPEED = DRIFT.minSpeed + 3;
const DRIFT_AFTER_MS = 300;
/** Camera: after this long on the road (ms), once the car moves. */
const CAMERA_AFTER_MS = 15000;
/** Boosting or drifting this long counts as done. */
const DONE_MS = 400;

function readLearned(): Set<Lesson> {
  try {
    const raw = JSON.parse(localStorage.getItem(LEARNED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? (raw as Lesson[]) : []);
  } catch {
    return new Set();
  }
}

function saveLearned(learned: Set<Lesson>) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned]));
  } catch {
    // storage blocked: it teaches again next time
  }
}

function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className={`flex h-9 items-center justify-center border-[3px] border-cream bg-bg px-2 text-sm text-cream shadow-[3px_3px_0_0_rgba(0,0,0,0.5)] ${wide ? "min-w-[4.5rem]" : "min-w-9"}`}
    >
      {children}
    </span>
  );
}

const TEXT = "text-base tracking-[0.2em] [text-shadow:2px_2px_0_rgba(0,0,0,0.6)]";
const HOLD = "text-[10px] tracking-[0.2em] text-cream/70 [text-shadow:2px_2px_0_rgba(0,0,0,0.6)]";

function Prompt({ lesson, item }: { lesson: Lesson; item: string | null }) {
  switch (lesson) {
    case "drive":
      return (
        <>
          <Key>W</Key>
          <Key>↑</Key>
          <span className={`${TEXT} text-cream`}>Drive</span>
        </>
      );
    case "steer":
      return (
        <>
          <Key>A</Key>
          <Key>D</Key>
          <span className={`${TEXT} text-cream`}>Steer</span>
        </>
      );
    case "boost":
      return (
        <>
          <span className={HOLD}>Hold</span>
          <Key wide>Shift</Key>
          <span className={`${TEXT} text-[#7ee8ff]`}>Boost</span>
        </>
      );
    case "drift":
      return (
        <>
          <span className={HOLD}>Hold</span>
          <Key wide>Space</Key>
          <span className={HOLD}>+ steer</span>
          <span className={`${TEXT} text-lime`}>Drift</span>
        </>
      );
    case "camera":
      return (
        <>
          <Key>C</Key>
          <span className={`${TEXT} text-cream`}>Change camera</span>
        </>
      );
    case "attack":
      return (
        <>
          <Key>F</Key>
          <span className={`${TEXT} text-[#ff9be8]`}>Throw {item ?? "it"}</span>
        </>
      );
  }
}

export default function DrivePrompt({
  telemetry,
  firstRun,
  onDrive,
}: {
  telemetry: DriveTelemetry;
  /** Handed over by the town intro: starts with drive and steer. */
  firstRun: boolean;
  /** You pressed the throttle (the HUD comes in). */
  onDrive?: () => void;
}) {
  const [lesson, setLesson] = useState<Lesson | null>(firstRun ? "drive" : null);
  const [idle, setIdle] = useState(false);
  const [item, setItem] = useState<string | null>(null);
  const onDriveRef = useRef(onDrive);
  useEffect(() => {
    onDriveRef.current = onDrive;
  }, [onDrive]);

  useEffect(() => {
    const learned = readLearned();
    const st = {
      lesson: (firstRun ? "drive" : null) as Lesson | null,
      shownAt: performance.now(),
      hiddenAt: 0,
      drove: !firstRun,
      droveAt: performance.now(),
      steered: false,
      steerAsked: !firstRun,
      cooldown: new Map<Lesson, number>(),
      fastSince: 0,
      turnSince: 0,
      doingSince: 0,
      fired: false,
    };
    const held = new Set<string>();
    const show = (next: Lesson | null) => {
      const now = performance.now();
      if (st.lesson && !next) st.hiddenAt = now;
      st.lesson = next;
      st.shownAt = now;
      st.doingSince = 0;
      setLesson(next);
    };
    const learn = (l: Lesson) => {
      if (REMEMBERED.has(l)) {
        learned.add(l);
        saveLearned(learned);
      }
      show(null);
    };
    const drove = () => {
      if (st.drove) return;
      st.drove = true;
      st.droveAt = performance.now();
      onDriveRef.current?.();
      if (st.lesson === "drive") show(null);
    };
    const onKey = (e: KeyboardEvent) => {
      held.add(e.code);
      if (THROTTLE.has(e.code)) drove();
      if (STEER.has(e.code)) {
        st.steered = true;
        if (st.lesson === "steer") show(null);
      }
      if (e.code === "KeyF" && st.lesson === "attack") {
        st.fired = true;
        learn("attack");
      }
      // Found it on your own: no need to teach it.
      if (e.code === "KeyC" && !e.repeat) {
        if (st.lesson === "camera") learn("camera");
        else if (!learned.has("camera")) {
          learned.add("camera");
          saveLearned(learned);
        }
      }
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.code);
    const onBlur = () => held.clear();

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const speed = telemetry.speed;
      if (speed > DRIVING_SPEED) drove();
      const steering = [...STEER].some((k) => held.has(k));
      st.fastSince = speed > BOOST_SPEED && !steering ? st.fastSince || now : 0;
      st.turnSince = speed > DRIFT_SPEED && steering ? st.turnSince || now : 0;
      const holding = isItem(telemetry.held) ? ITEM_NAMES[telemetry.held] : null;

      // The prompt on screen: done, or ignored long enough.
      const l = st.lesson;
      if (l) {
        const doing = (l === "boost" && telemetry.boosting) || (l === "drift" && telemetry.drifting);
        st.doingSince = doing ? st.doingSince || now : 0;
        if (st.doingSince && now - st.doingSince > DONE_MS) return learn(l);
        if (l === "attack" && !holding) return show(null); // used it up some other way
        if (now - st.shownAt > SHOW_MS[l]) {
          st.cooldown.set(l, now + COOLDOWN_MS);
          return show(null);
        }
        return;
      }

      // Nothing on screen: the next one that fits the moment.
      if (!st.drove || now - st.hiddenAt < GAP_MS) return;
      const ready = (x: Lesson) => !learned.has(x) && (st.cooldown.get(x) ?? 0) < now;
      if (!st.steerAsked && now - st.droveAt > STEER_DELAY_MS) {
        st.steerAsked = true;
        if (!st.steered) return show("steer");
      }
      if (holding && ready("attack")) {
        setItem(holding.toLowerCase());
        return show("attack");
      }
      if (st.turnSince && now - st.turnSince > DRIFT_AFTER_MS && ready("drift")) return show("drift");
      if (st.fastSince && now - st.fastSince > BOOST_AFTER_MS && ready("boost")) return show("boost");
      if (now - st.droveAt > CAMERA_AFTER_MS && ready("camera")) return show("camera");
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    const idleTimer = window.setTimeout(() => setIdle(true), IDLE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      window.clearTimeout(idleTimer);
    };
  }, [telemetry, firstRun]);

  if (!lesson) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center">
      <div
        key={lesson}
        role="status"
        aria-live="polite"
        // The first one waits for the intro's title to fade and its bars to pull back.
        className={`flex items-center gap-3 ${lesson === "drive" ? "animate-[fade-in_0.4s_ease-out_0.5s_both]" : "animate-[fade-in_0.3s_ease-out_both]"}`}
      >
        <div className={`flex items-center gap-3 transition-transform duration-300 ${idle && lesson === "drive" ? "scale-125 animate-pulse" : ""}`}>
          <Prompt lesson={lesson} item={item} />
        </div>
      </div>
    </div>
  );
}
