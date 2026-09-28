"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { RIVALRY, BATTLE_START, timeUntil } from "@/lib/towns/rivalry";

const [CLAUDE, CODEX] = RIVALRY;

/**
 * The one way from the city into the rivalry before launch. Same frame as the
 * Road to 100K card it replaces: a label row, the two names, a tug bar of who
 * picked, and the countdown to the first battle week.
 */
export default function RivalryCta({ from, accent }: { from: string; accent: string }) {
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [left, setLeft] = useState("");

  useEffect(() => {
    fetch("/api/towns/rivalry")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { picked?: [number, number] } | null) => d?.picked && setPicked(d.picked))
      .catch(() => {});
    const tick = () => setLeft(timeUntil(BATTLE_START, Date.now()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const total = picked ? picked[0] + picked[1] : 0;
  const share = total > 0 ? (picked![0] / total) * 100 : 50;

  return (
    <Link
      href="/towns"
      onClick={() => posthog.capture("rivalry_cta_clicked", { from })}
      className="group block w-full max-w-md border-[2px] border-border bg-bg/80 px-4 py-3 backdrop-blur-sm transition-colors hover:border-border-light"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[9px] tracking-wider" style={{ color: accent }}>
          Git City Towns
        </span>
        {left && <span className="text-[9px] text-cream/60">Starts in {left}</span>}
      </div>

      <div className="mb-2 flex items-baseline justify-center gap-3 text-base leading-none sm:text-lg">
        <span style={{ color: CLAUDE.color }}>{CLAUDE.name}</span>
        <span className="text-[10px] text-cream/40">vs</span>
        <span style={{ color: CODEX.color }}>{CODEX.name}</span>
      </div>

      <div className="relative flex h-2.5 w-full overflow-hidden border-[2px] border-border bg-bg">
        <div className="transition-all duration-1000" style={{ width: `${share}%`, backgroundColor: CLAUDE.color }} />
        <div className="flex-1" style={{ backgroundColor: CODEX.color }} />
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[10px] tabular-nums" style={{ color: CLAUDE.color }}>
          {picked ? picked[0].toLocaleString() : "–"}
        </span>
        <span className="text-[9px] text-cream transition-colors group-hover:text-white">Pick your side &#8594;</span>
        <span className="text-[10px] tabular-nums" style={{ color: CODEX.color }}>
          {picked ? picked[1].toLocaleString() : "–"}
        </span>
      </div>
    </Link>
  );
}
