"use client";

import { useEffect, useRef, useState } from "react";
import { TERMINAL_KEYFRAMES, TERMINAL_LIME as LIME, TERMINAL_TEXT_CLASS, TERMINAL_TEXT_STYLE, TerminalBackdrop, TerminalCursor } from "@/components/Terminal";
import { gateCommand, gateLines, type GateLine, type GateReason } from "@/lib/league-city/drive/guest-gate";

// A guest gets pulled over (lib drive/guest-gate): the car stops, the game's
// terminal types a commit and git refuses it for want of an author. Enter
// signs in with GitHub, Esc (or `--allow-anonymous`) drives on.

const TYPE_MS = 32;
const LINE_MS = 140;

const TONE: Record<GateLine["tone"], string> = {
  error: "text-[#e05252]",
  warn: "text-[#ffcf33]",
  hint: "text-neutral-400",
  plain: "text-neutral-300",
};

// Standard gamepad buttons.
const PAD_A = 0;
const PAD_B = 1;

export default function GuestGate({
  reason,
  stops,
  guest,
  drivenMs,
  onSignIn,
  onContinue,
}: {
  reason: GateReason;
  /** How many times this guest was stopped before. */
  stops: number;
  guest: string;
  drivenMs: number;
  onSignIn: () => void;
  onContinue: () => void;
}) {
  const [command] = useState(() => gateCommand(reason, stops));
  const [lines] = useState(() => gateLines(reason, stops, guest, drivenMs));
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const done = typed >= command.length && shown >= lines.length;

  useEffect(() => {
    if (typed < command.length) {
      const t = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    if (shown < lines.length) {
      const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? LINE_MS * 3 : LINE_MS);
      return () => clearTimeout(t);
    }
  }, [typed, shown, command.length, lines.length]);

  const signIn = () => {
    if (busy) return;
    setBusy(true);
    onSignIn();
  };
  const actions = useRef({ signIn, onContinue, done });
  useEffect(() => {
    actions.current = { signIn, onContinue, done };
  });

  // Keyboard: fresh presses only, so a held drift or throttle key can't answer for you.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        actions.current.onContinue();
      } else if (e.key === "Enter" && actions.current.done) {
        e.preventDefault();
        actions.current.signIn();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Gamepad: A signs in, B drives on (edges, ignoring what was held when it opened).
  useEffect(() => {
    let raf = 0;
    let prev: boolean[] | null = null;
    const tick = () => {
      const pad = typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()].find((p) => p?.connected) : null;
      if (pad) {
        const now = pad.buttons.map((b) => b.pressed);
        if (prev) {
          if (now[PAD_A] && !prev[PAD_A] && actions.current.done) actions.current.signIn();
          if (now[PAD_B] && !prev[PAD_B]) actions.current.onContinue();
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
      role="alertdialog"
      aria-label="Sign in to keep your name on it"
      className="pointer-events-auto absolute inset-0 flex animate-[fade-in_0.6s_ease-out] items-center justify-center bg-black/85 px-4 normal-case"
    >
      <style>{TERMINAL_KEYFRAMES}</style>
      <TerminalBackdrop />
      <div className={`relative ${TERMINAL_TEXT_CLASS}`} style={TERMINAL_TEXT_STYLE}>
        <div className="min-h-[1.9em] break-words">
          <span style={{ color: LIME }}>$ </span>
          <span className="text-neutral-300">{command.slice(0, typed)}</span>
          {typed < command.length && <TerminalCursor />}
        </div>
        <div className="min-h-[1.9em]" />
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} className={`min-h-[1.9em] whitespace-pre-wrap break-words ${TONE[l.tone]}`}>
            {l.text}
          </div>
        ))}

        <div className={`mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 transition-opacity duration-300 ${done ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <button type="button" onClick={signIn} disabled={busy} className="btn-press px-6 py-2 font-pixel text-xs text-bg" style={{ backgroundColor: LIME }}>
            {busy ? "Signing in..." : "Sign in with GitHub"}
          </button>
          <button type="button" onClick={onContinue} className="font-pixel text-xs text-neutral-500 transition-colors hover:text-neutral-300">
            --allow-anonymous
          </button>
        </div>
        <p className={`mt-4 text-[9px] text-neutral-600 max-sm:hidden transition-opacity duration-300 ${done ? "opacity-100" : "opacity-0"}`}>
          Enter sign in · Esc keep driving
        </p>
      </div>
    </div>
  );
}
