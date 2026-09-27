"use client";

import { useEffect, useState } from "react";
import { HUD_BOX } from "@/components/league/hud/shared";
import { medalScores, type LiveSpot } from "@/lib/drift/spots/types";
import { DRIFT_CONTROLS, MEDAL_COLORS, fmt } from "./DriftHud";

// Before the run, over the camera's wide shot of the spot: the spot's card
// (name, what it is, the four medals, your best, the record, the ghost you
// race) and the controls. Enter starts the 3-2-1, which is the camera coming
// down onto the car. Loading shows the town's "Starting engine" screen with
// the spot's name, so the wait teaches the controls.

export function DriftLoading({ spot, ready }: { spot: LiveSpot; ready: boolean }) {
  const [progress, setProgress] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setGone(true), 450);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setProgress(0.9 * (1 - Math.exp(-(now - start) / 1500)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);
  if (gone) return null;
  const filled = Math.round((ready ? 1 : progress) * 16);
  return (
    <div role="status" aria-live="polite" className={`fixed inset-0 z-50 flex items-center justify-center bg-bg font-pixel uppercase transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`}>
      <div className="flex flex-col gap-8 px-6">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-muted">Drift</span>
          <h2 className="text-2xl tracking-[0.2em] text-cream sm:text-4xl sm:tracking-[0.25em]">{spot.name}</h2>
        </div>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className={`h-4 w-5 border-2 ${i < filled ? "border-lime bg-lime" : "border-border bg-bg"}`} />
          ))}
        </div>
        <Controls />
      </div>
    </div>
  );
}

function Controls() {
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-2 self-start text-[10px]">
      {DRIFT_CONTROLS.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-cream">{k}</dt>
          <dd className="text-muted">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function DriftTitle({
  spot,
  best,
  record,
  rival,
  challenger,
  onStart,
  onSpots,
}: {
  spot: LiveSpot;
  best: number | null;
  record: { login: string; score: number } | null;
  rival: string | null;
  challenger: string | null;
  onStart: () => void;
  onSpots: () => void;
}) {
  const medals = medalScores(spot);
  return (
    <div className="pointer-events-none fixed inset-0 z-30 font-pixel uppercase">
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-bg/90 to-transparent" />
      <section className={`${HUD_BOX} pointer-events-auto absolute bottom-8 left-8 flex w-[440px] max-w-[calc(100vw-2rem)] animate-[fade-in_0.35s_ease-out_both] flex-col gap-4 px-6 py-5`}>
        {challenger && <span className="self-start bg-lime px-2 py-0.5 text-[10px] text-bg">@{challenger} challenges you</span>}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-muted">Drift spot</span>
          <h1 className="text-4xl tracking-[0.15em] text-cream">{spot.name}</h1>
          <p className="text-[10px] normal-case leading-relaxed text-muted">{spot.tagline}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {medals.map(([m, at]) => (
            <div key={m} className="flex flex-col gap-1 border-2 px-2 py-1.5" style={{ borderColor: MEDAL_COLORS[m] }}>
              <span className="text-[8px]" style={{ color: MEDAL_COLORS[m] }}>
                {m}
              </span>
              <span className="text-[10px] text-cream tabular-nums">{fmt(at)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 border-t-2 border-border pt-3 text-[10px]">
          <p className="flex justify-between">
            <span className="text-muted">Your best</span>
            <span className="text-cream tabular-nums">{best !== null ? fmt(best) : "-"}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted">Record</span>
            <span className="normal-case text-cream tabular-nums">{record ? `${fmt(record.score)} @${record.login}` : "Nobody yet"}</span>
          </p>
          {rival && (
            <p className="flex justify-between">
              <span className="text-muted">Ghost</span>
              <span className="normal-case text-cream">@{rival}</span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <button
            type="button"
            onClick={onStart}
            autoFocus
            className="flex items-center justify-center gap-2 bg-lime px-3 py-3 text-[12px] text-bg outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cream active:translate-y-px"
          >
            <span className="border-2 border-bg px-1 text-[10px]">Enter</span> Drift
          </button>
          <button type="button" onClick={onSpots} className="flex items-center justify-center gap-2 border-2 border-border px-3 py-3 text-[11px] text-cream transition-colors hover:text-lime">
            Spots
          </button>
        </div>
      </section>
      <div className={`${HUD_BOX} absolute bottom-8 right-8 hidden px-5 py-4 lg:block`}>
        <Controls />
      </div>
    </div>
  );
}
