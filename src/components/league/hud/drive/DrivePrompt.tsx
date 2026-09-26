"use client";

import { useEffect, useRef, useState } from "react";
import type { DriveTelemetry } from "@/lib/league-city/drive/telemetry";

// The first drive, handed over by the town intro: one prompt at a time, the
// way games teach in the first seconds of play (Forza's "hold to accelerate").
//   drive   W / ↑ while the car still rolls; grows and pulses harder if you
//           wait, gone the moment you press it
//   steer   A D / ← → a beat later, if you haven't steered yet; gone when you
//           do, or after a few seconds
// A gamepad counts as driving once the car speeds up.

const THROTTLE = new Set(["KeyW", "ArrowUp"]);
const STEER = new Set(["KeyA", "KeyD", "ArrowLeft", "ArrowRight"]);
/** Waiting this long on the first prompt makes it insist. */
const IDLE_MS = 4000;
/** After you drive, the steer prompt waits this long for you to steer on your own. */
const STEER_DELAY_MS = 1200;
/** The steer prompt gives up after this long. */
const STEER_MS = 5000;
/** Faster than the car rolls at the handoff (m/s): someone is on the throttle. */
const DRIVING_SPEED = 9;

type Step = "drive" | "steer" | "done";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 min-w-9 items-center justify-center border-[3px] border-cream bg-bg px-2 text-sm text-cream shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]">
      {children}
    </span>
  );
}

export default function DrivePrompt({ telemetry, onDrive }: { telemetry: DriveTelemetry; onDrive: () => void }) {
  const [step, setStep] = useState<Step>("drive");
  const [idle, setIdle] = useState(false);
  const steered = useRef(false);
  const stepRef = useRef<Step>("drive");
  const onDriveRef = useRef(onDrive);
  useEffect(() => {
    onDriveRef.current = onDrive;
  }, [onDrive]);

  useEffect(() => {
    const go = (next: Step) => {
      stepRef.current = next;
      setStep(next);
    };
    const drove = () => {
      if (stepRef.current !== "drive") return;
      onDriveRef.current();
      go("done");
      window.setTimeout(() => {
        if (!steered.current) go("steer");
      }, STEER_DELAY_MS);
    };
    const onKey = (e: KeyboardEvent) => {
      if (STEER.has(e.code)) {
        steered.current = true;
        if (stepRef.current === "steer") go("done");
      }
      if (THROTTLE.has(e.code)) drove();
    };
    let raf = 0;
    const tick = () => {
      if (telemetry.speed > DRIVING_SPEED) drove();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKey);
    const idleTimer = window.setTimeout(() => setIdle(true), IDLE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(idleTimer);
    };
  }, [telemetry]);

  useEffect(() => {
    if (step !== "steer") return;
    const t = window.setTimeout(() => {
      stepRef.current = "done";
      setStep("done");
    }, STEER_MS);
    return () => window.clearTimeout(t);
  }, [step]);

  if (step === "done") return null;
  return (
    <div className="absolute inset-x-0 bottom-[22%] flex justify-center">
      <div
        key={step}
        role="status"
        aria-live="polite"
        // Waits for the title to fade and the bars to pull back, then comes in.
        className="flex items-center gap-3 animate-[fade-in_0.4s_ease-out_0.5s_both]"
      >
        <div
          className={`flex items-center gap-3 transition-transform duration-300 ${idle && step === "drive" ? "scale-125 animate-pulse" : ""}`}
        >
          {step === "drive" ? (
            <>
              <Key>W</Key>
              <Key>↑</Key>
            </>
          ) : (
            <>
              <Key>A</Key>
              <Key>D</Key>
            </>
          )}
          <span className="text-base tracking-[0.2em] text-cream [text-shadow:2px_2px_0_rgba(0,0,0,0.6)]">
            {step === "drive" ? "Drive" : "Steer"}
          </span>
        </div>
      </div>
    </div>
  );
}
