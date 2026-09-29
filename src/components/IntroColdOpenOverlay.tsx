"use client";

import { useEffect, useState } from "react";
import { COLD_OPEN, coldOpen } from "./IntroColdOpen";

// The DOM half of the home intro: letterbox bars that close in as it starts
// and open as the UI lands, and one line of text per shot in the lower bar.
// It follows the camera's clock (`coldOpen`), re-rendering only when a line
// or the bars change. Any key, click or tap skips.

const LINES = ["Somewhere in the internet...", "Developers became buildings", "And commits became floors"];

export default function IntroColdOpenOverlay({ accent, onSkip }: { accent: string; onSkip: () => void }) {
  const [line, setLine] = useState(-1);
  const [bars, setBars] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = coldOpen.active ? coldOpen.t : 0;
      let next = -1;
      COLD_OPEN.lines.forEach((at, i) => { if (t >= at) next = i; });
      setLine(next);
      setBars(coldOpen.active && t < COLD_OPEN.barsOpen);
    };
    raf = requestAnimationFrame(tick);
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

  // Text leaves with the bars.
  const shown = bars ? line : -1;
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Letterbox bars (transform: scaleY for composited-only GPU animation) */}
      <div
        className="absolute inset-x-0 top-0 origin-top bg-black/80 transition-transform duration-1000"
        style={{ height: "12%", transform: bars ? "scaleY(1)" : "scaleY(0)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 origin-bottom bg-black/80 transition-transform duration-1000"
        style={{ height: "18%", transform: bars ? "scaleY(1)" : "scaleY(0)" }}
      />

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center" style={{ height: "18%" }}>
        {LINES.map((text, i) => (
          <p
            key={i}
            className="absolute text-center font-pixel normal-case text-cream"
            style={{
              fontSize: "clamp(0.85rem, 3vw, 1.5rem)",
              letterSpacing: "0.05em",
              opacity: shown === i ? 1 : 0,
              transition: "opacity 0.7s ease-in-out",
            }}
          >
            {text}
          </p>
        ))}
        <p
          className="absolute text-center font-pixel uppercase text-cream"
          style={{
            fontSize: "clamp(1.2rem, 5vw, 2.8rem)",
            opacity: shown === 3 ? 1 : 0,
            transform: shown === 3 ? "scale(1)" : "scale(0.95)",
            transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
          }}
        >
          Welcome to <span style={{ color: accent }}>Git City</span>
        </p>
      </div>

      <p className="absolute top-4 right-4 font-pixel text-[10px] uppercase text-cream/40 sm:text-xs">
        Skip &gt;
      </p>
    </div>
  );
}
