"use client";

import { useEffect, useRef } from "react";
import { TERMINAL_LIME } from "./Terminal";
import { COLD_OPEN, coldOpen } from "./IntroColdOpen";

// The DOM half of the home intro: the game's terminal (the Bay trailer's
// panel), typing one line at a time behind the lime block cursor. It reads
// the camera's clock (`coldOpen`) every animation frame and writes straight
// to the DOM, so the page never re-renders. Any key, click or tap skips.

const TYPE_EVERY = 0.045; // s per letter
const FADE = 0.2; // s

/** [from, to, text] in seconds; {n} is the live count of developers in frame. */
const LINES: [number, number, string][] = [
  [0.3, COLD_OPEN.pull - 0.1, "every building is a developer."],
  [COLD_OPEN.pull + 0.2, COLD_OPEN.reveal, "{n} developers."],
  [COLD_OPEN.reveal + 0.15, COLD_OPEN.dive + 0.2, "welcome to git city."],
];

export default function IntroColdOpenOverlay({ onSkip }: { onSkip: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = coldOpen.active ? coldOpen.t : 0;
      const line = LINES.find(([from, to]) => t >= from && t < to);
      if (!panel.current) return;
      if (!line) { panel.current.style.opacity = "0"; return; }
      const [from, to, template] = line;
      const words = template.replace("{n}", coldOpen.count.toLocaleString("en-US"));
      const since = t - from;
      panel.current.style.opacity = String(Math.min(1, since / FADE, (to - t) / FADE));
      const typed = Math.min(words.length, Math.floor(since / TYPE_EVERY) + 1);
      if (text.current) text.current.textContent = words.slice(0, typed);
      // Solid while typing, then it blinks.
      const on = typed < words.length || Math.floor(since * 2) % 2 === 0;
      if (cursor.current) cursor.current.style.opacity = on ? "1" : "0";
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    // Wait a beat so the click that started a replay doesn't skip it.
    const armed = window.setTimeout(() => {
      window.addEventListener("keydown", onSkip);
      window.addEventListener("pointerdown", onSkip);
    }, 300);
    return () => {
      window.clearTimeout(armed);
      window.removeEventListener("keydown", onSkip);
      window.removeEventListener("pointerdown", onSkip);
    };
  }, [onSkip]);

  const size = "clamp(0.8rem, 2.1vw, 1.6rem)";
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        ref={panel}
        className="absolute border-[3px] border-border bg-bg/90 font-pixel"
        style={{ opacity: 0, left: "5%", top: "8%", padding: "0.7em 1em", fontSize: size }}
      >
        <p style={{ lineHeight: 1, color: TERMINAL_LIME, textShadow: `0 0 0.4em ${TERMINAL_LIME}55`, whiteSpace: "nowrap" }}>
          <span className="text-muted">&gt; </span>
          <span ref={text} className="tabular-nums" />
          <span ref={cursor} className="inline-block align-bottom" style={{ width: "0.55em", height: "1em", marginLeft: "0.15em", backgroundColor: TERMINAL_LIME }} />
        </p>
      </div>
      <p className="absolute right-4 font-pixel text-[10px] uppercase text-cream/40 sm:text-xs" style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        Skip &gt;
      </p>
    </div>
  );
}
