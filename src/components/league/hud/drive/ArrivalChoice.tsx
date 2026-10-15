"use client";

import { useEffect, useRef, useState } from "react";

// The game freezes on a choice before you drive on: the town intro asks a
// newcomer to put their building here, the guest gate asks a guest to sign
// in. Two big options side by side (stacked on a phone). Enter (or the
// gamepad's A) takes the main one, Esc (or B) drives on.

const PAD_A = 0;
const PAD_B = 1;

function KeyHint({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={`border-2 px-1.5 py-0.5 text-[9px] max-sm:hidden ${dark ? "border-bg/40 text-bg/70" : "border-border text-muted"}`}>
      {children}
    </span>
  );
}

export default function ArrivalChoice({
  eyebrow,
  title,
  label,
  detail,
  busyLabel = "Opening...",
  driveLabel = "Just drive",
  driveDetail,
  onJoin,
  onDrive,
}: {
  /** The small line over the title: "Welcome to Claude Code". */
  eyebrow: string;
  title: string;
  /** The main action: "Add your building", "Sign in with GitHub"… */
  label: string;
  /** One line on what the main action does. */
  detail: string;
  busyLabel?: string;
  driveLabel?: string;
  driveDetail: string;
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
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
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
    <div
      role="dialog"
      aria-label={title}
      // Waits for the intro's title to fade and its bars to pull back.
      className="pointer-events-auto absolute inset-0 flex animate-[fade-in_0.4s_ease-out_0.4s_both] items-center justify-center bg-bg/70 px-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-[720px] flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-3 text-center">
          <p className="text-[10px] tracking-widest text-lime sm:text-xs">{eyebrow}</p>
          <h2 className="text-xl leading-snug text-cream sm:text-3xl">{title}</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="btn-press flex flex-col gap-3 border-[3px] border-lime bg-lime p-4 text-left text-bg disabled:opacity-70 sm:p-6"
          >
            <span className="text-sm tracking-widest sm:text-base">{busy ? busyLabel : label}</span>
            <span className="text-[11px] leading-relaxed normal-case text-bg/80 sm:text-xs">{detail}</span>
            <span className="mt-auto pt-1 max-sm:hidden">
              <KeyHint dark>Enter</KeyHint>
            </span>
          </button>

          <button
            type="button"
            onClick={onDrive}
            className="btn-press flex flex-col gap-3 border-[3px] border-border bg-bg-card p-4 text-left text-cream transition-colors hover:border-cream sm:p-6"
          >
            <span className="text-sm tracking-widest sm:text-base">{driveLabel}</span>
            <span className="text-[11px] leading-relaxed normal-case text-muted sm:text-xs">{driveDetail}</span>
            <span className="mt-auto pt-1 max-sm:hidden">
              <KeyHint>Esc</KeyHint>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
