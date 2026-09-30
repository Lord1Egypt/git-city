"use client";

import { useEffect, useRef, useState } from "react";

// The town intro hands a newcomer the car and stops on a choice, where a
// member gets the "W Drive" prompt: put your building here, or just drive.
// It sits where the drive prompt sits, in the same key caps. Enter (or the
// gamepad's A) takes the building, W / ↑ (or Esc, or B) drives on; on a
// phone both are buttons. The car brakes to a stop underneath (DriveWorld held).

const THROTTLE = new Set(["KeyW", "ArrowUp"]);
const PAD_A = 0;
const PAD_B = 1;

function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className={`flex h-9 items-center justify-center border-[3px] border-cream bg-bg px-2 text-sm text-cream shadow-[3px_3px_0_0_rgba(0,0,0,0.5)] ${wide ? "min-w-[4.5rem]" : "min-w-9"}`}
    >
      {children}
    </span>
  );
}

export default function ArrivalChoice({
  town,
  label,
  touch = false,
  onJoin,
  onDrive,
}: {
  /** The town's display name. */
  town: string;
  /** The main action: "Add your building", "Ask to move in"… */
  label: string;
  touch?: boolean;
  onJoin: () => void;
  onDrive: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const join = () => {
    if (busy) return;
    setBusy(true);
    onJoin();
  };
  const actions = useRef({ join, onDrive });
  useEffect(() => {
    actions.current = { join, onDrive };
  });

  // Keyboard: fresh presses only, so a key held through the intro can't answer for you.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Enter") {
        e.preventDefault();
        actions.current.join();
      } else if (e.key === "Escape" || THROTTLE.has(e.code)) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        actions.current.onDrive();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Gamepad: A takes the building, B drives on (edges, ignoring what was held when it opened).
  useEffect(() => {
    let raf = 0;
    let prev: boolean[] | null = null;
    const tick = () => {
      const pad = typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()].find((p) => p?.connected) : null;
      if (pad) {
        const now = pad.buttons.map((b) => b.pressed);
        if (prev) {
          if (now[PAD_A] && !prev[PAD_A]) actions.current.join();
          if (now[PAD_B] && !prev[PAD_B]) actions.current.onDrive();
        }
        prev = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${touch ? "top-[24%]" : "bottom-[22%]"}`}>
      {/* Waits for the intro's title to fade and its bars to pull back, like the drive prompt. */}
      <div role="dialog" aria-label={`Want your building in ${town}?`} className="flex animate-[fade-in_0.4s_ease-out_0.5s_both] flex-col items-center gap-4">
        <p className="text-center text-[11px] tracking-widest sm:text-[13px] text-cream [text-shadow:2px_2px_0_rgba(0,0,0,0.6)]">
          Want your building in {town}?
        </p>
        {touch ? (
          <div className="pointer-events-auto flex flex-col items-stretch gap-2">
            <button type="button" onClick={join} disabled={busy} className="btn-press bg-lime px-6 py-3 text-[11px] tracking-widest text-bg disabled:opacity-60">
              {busy ? "Opening..." : label}
            </button>
            <button type="button" onClick={onDrive} className="btn-press border-[3px] border-cream bg-bg/70 px-6 py-2.5 text-[11px] tracking-widest text-cream">
              Just drive
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center gap-8">
            <button type="button" onClick={join} disabled={busy} className="group flex items-center gap-3 disabled:opacity-60">
              <Key wide>Enter</Key>
              <span className="text-lg tracking-widest text-lime [text-shadow:2px_2px_0_rgba(0,0,0,0.6)] group-hover:underline">
                {busy ? "Opening..." : label}
              </span>
            </button>
            <button type="button" onClick={onDrive} className="group flex items-center gap-3">
              <Key>W</Key>
              <span className="text-lg tracking-widest text-cream [text-shadow:2px_2px_0_rgba(0,0,0,0.6)] group-hover:underline">Just drive</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
