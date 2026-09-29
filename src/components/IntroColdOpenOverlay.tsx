"use client";

import { useEffect, useRef } from "react";
import { TERMINAL_LIME } from "./Terminal";
import { COLD_OPEN, coldOpen } from "./IntroColdOpen";

// The DOM half of the home intro: the game's terminal (the Bay trailer's
// panel) in the upper left, where every take has sky. Each take types one
// line of a git log on its cut, behind the lime block cursor; earlier lines
// stay above it, dimmed, like a real session. It reads the camera's clock
// (`coldOpen`) every animation frame and writes straight to the DOM, so the
// page never re-renders. Any key, click or tap skips.

const TYPE_EVERY = 0.045; // s per letter
const FADE = 0.25; // s

/** [typing starts, text], one per take, typed just after its cut. */
function linesFor(total: number): [number, string][] {
  return [
    [0.4, "$ git init city"],
    [COLD_OPEN.bridge + 0.15, "$ git add developers"],
    [COLD_OPEN.climb + 0.15, "$ git commit --floors"],
    [COLD_OPEN.zoom + 0.15, `${total.toLocaleString("en-US")} contributors.`],
    [COLD_OPEN.dive + 0.15, "Welcome to Git City."],
  ];
}

export default function IntroColdOpenOverlay({ total, onSkip }: { total: number; onSkip: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLParagraphElement | null)[]>([]);
  const texts = useRef<(HTMLSpanElement | null)[]>([]);
  const cursors = useRef<(HTMLSpanElement | null)[]>([]);

  const lines = linesFor(total);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = coldOpen.active ? coldOpen.t : 0;
      const all = linesFor(total);
      if (panel.current) {
        const show = Math.min(1, (t - all[0][0]) / FADE, (COLD_OPEN.land - t) / FADE);
        panel.current.style.opacity = String(Math.max(0, show));
      }
      let current = -1;
      all.forEach(([at, words], i) => {
        const row = rows.current[i];
        const text = texts.current[i];
        if (!row || !text) return;
        if (t < at) { row.style.display = "none"; return; }
        current = i;
        row.style.display = "block";
        text.textContent = words.slice(0, Math.min(words.length, Math.floor((t - at) / TYPE_EVERY) + 1));
      });
      // Earlier lines dim; the cursor sits on the one being typed, blinking once done.
      all.forEach((_, i) => {
        const row = rows.current[i];
        if (row) row.style.opacity = i === current ? "1" : "0.45";
      });
      all.forEach(([at, words], i) => {
        const c = cursors.current[i];
        if (!c) return;
        const done = (t - at) / TYPE_EVERY >= words.length;
        c.style.opacity = i === current && (!done || Math.floor((t - at) * 2) % 2 === 0) ? "1" : "0";
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [total]);

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

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        ref={panel}
        className="absolute border-[3px] border-border bg-bg/90 font-pixel normal-case"
        style={{ opacity: 0, left: "5%", top: "8%", padding: "0.8em 1.1em", fontSize: "clamp(0.75rem, 1.7vw, 1.3rem)" }}
      >
        {lines.map((_, i) => (
          <p
            key={i}
            ref={(el) => { rows.current[i] = el; }}
            style={{ display: "none", lineHeight: 1.7, color: TERMINAL_LIME, textShadow: `0 0 0.4em ${TERMINAL_LIME}55`, whiteSpace: "nowrap" }}
          >
            <span ref={(el) => { texts.current[i] = el; }} className="tabular-nums" />
            <span
              ref={(el) => { cursors.current[i] = el; }}
              className="inline-block align-middle"
              style={{ opacity: 0, width: "0.55em", height: "1em", marginLeft: "0.2em", backgroundColor: TERMINAL_LIME }}
            />
          </p>
        ))}
      </div>
      <p className="absolute top-4 right-4 font-pixel text-[10px] uppercase text-cream/40 sm:text-xs">
        Skip &gt;
      </p>
    </div>
  );
}
