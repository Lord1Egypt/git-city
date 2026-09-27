"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Ghost as GhostIcon, Volume2, VolumeX, X } from "lucide-react";
import { HUD_BOX } from "@/components/league/hud/shared";
import type { TrialStage } from "@/lib/league-city/race/trial";
import { DRIFT_SCORE } from "@/lib/drift/score";
import { medalScores, type LiveSpot, type Medal } from "@/lib/drift/spots/types";
import type { DriftTelemetry } from "@/lib/drift/telemetry";
import { markSeen, seen } from "@/lib/drift/local";

// The drift HUD, in the town drive's pattern (Dash, DrivePrompt, the button
// group). Top left: the banked score, the next medal on a block bar and where
// you'd stand on the board. Above the car: the combo at risk and its
// multiplier, with how long is left to link the next drift (lime, then orange
// and shaking as it runs out: Absolute Drift, NFSU). Bottom: the dash, with
// the drift angle as blocks (dead, scoring, too much, so a drift that scores
// nothing never looks like one that does), the speed, and the drift key lit
// while you're sideways. Right: what just banked, got lost or clipped.
// H hides all of it, G the ghosts.

export const MEDAL_COLORS: Record<Medal, string> = { author: "#3ddc6b", gold: "#ffcf33", silver: "#cfd8e3", bronze: "#d98a4e" };

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export const DRIFT_CONTROLS: [string, string][] = [
  ["W A S D", "Drive"],
  ["Hold Space + steer", "Drift"],
  ["Steer in / out", "Open / close the angle"],
  ["R", "Start over"],
  ["Enter", "Last checkpoint"],
  ["G / H", "Ghosts / HUD"],
  ["C", "Camera"],
  ["Esc", "Pause"],
];

const ANGLE_MAX = 90;
const ANGLE_BLOCKS = 18;
const SPEED_BLOCKS = 12;
const SPEED_TOP = 28; // m/s, ~100 km/h: past this the bar is full

export function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 min-w-9 items-center justify-center border-[3px] border-cream bg-bg px-2 text-sm text-cream shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]">
      {children}
    </span>
  );
}

const HINTS: { keys: string[]; text: string }[] = [
  { keys: ["Space", "←", "→"], text: "Hold to drift" },
  { keys: ["→"], text: "Steer in to open the angle" },
  { keys: ["↑"], text: "Straighten out to bank it" },
];

export interface DriftHudProps {
  spot: LiveSpot;
  telemetry: DriftTelemetry;
  ready: boolean;
  stage: TrialStage;
  paused: boolean;
  muted: boolean;
  showGhosts: boolean;
  best: number | null;
  /** World board scores, best first (for the live rank). */
  boardScores: number[];
  onToggleGhosts: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onPause: (on: boolean) => void;
  onRestart: () => void;
  onRespawn: () => void;
  onExit: () => void;
}

const angleBand = (i: number) => {
  const deg = ((i + 0.5) / ANGLE_BLOCKS) * ANGLE_MAX;
  return deg < DRIFT_SCORE.minAngle ? "dead" : deg > DRIFT_SCORE.maxAngle ? "over" : "ideal";
};

export default function DriftHud(p: DriftHudProps) {
  const { telemetry: tel } = p;
  const score = useRef<HTMLSpanElement>(null);
  const rank = useRef<HTMLSpanElement>(null);
  const goal = useRef<HTMLSpanElement>(null);
  const goalBar = useRef<HTMLDivElement>(null);
  const split = useRef<HTMLSpanElement>(null);
  const combo = useRef<HTMLDivElement>(null);
  const risk = useRef<HTMLSpanElement>(null);
  const mult = useRef<HTMLSpanElement>(null);
  const chain = useRef<HTMLSpanElement>(null);
  const angle = useRef<HTMLDivElement>(null);
  const angleText = useRef<HTMLSpanElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const speedBar = useRef<HTMLDivElement>(null);
  const driftKey = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const [cue, setCue] = useState("");
  const [hidden, setHidden] = useState(false);
  const [hint, setHint] = useState<number | null>(null);

  const medals = medalScores(p.spot);
  const live = p.ready && (p.stage === "countdown" || p.stage === "run");

  const toggles = useRef({ ghosts: p.onToggleGhosts });
  useEffect(() => {
    toggles.current = { ghosts: p.onToggleGhosts };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.code === "KeyH") setHidden((h) => !h);
      if (e.code === "KeyG") toggles.current.ghosts();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The first run anywhere: three prompts, each at the moment it applies (DrivePrompt's way).
  const hintState = useRef({ on: false, step: 0, since: 0 });
  useEffect(() => {
    const h = hintState.current;
    if (p.stage === "run" && !seen("hints")) h.on = true;
    else if (p.stage === "finish" && h.on) {
      h.on = false;
      markSeen("hints");
      setHint(null);
    }
  }, [p.stage]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const d = tel.drift;
      const now = performance.now();
      const total = d ? d.score : 0;
      if (score.current) score.current.textContent = fmt(total);
      const running = total + (d?.risk ?? 0);
      if (rank.current) {
        const n = p.boardScores.length;
        const above = p.boardScores.filter((s) => s > running).length;
        rank.current.textContent = n === 0 ? "" : above >= n ? `#${n}+` : `#${above + 1}`;
      }
      const next = [...medals].reverse().find(([, at]) => at > total) ?? null;
      if (goal.current) goal.current.textContent = next ? `${next[0]} ${fmt(next[1])}` : "Author beaten";
      if (goalBar.current) {
        const lit = next ? Math.round(Math.min(1, total / next[1]) * 12) : 12;
        const color = next ? MEDAL_COLORS[next[0]] : MEDAL_COLORS.author;
        const blocks = goalBar.current.children;
        for (let i = 0; i < blocks.length; i++) (blocks[i] as HTMLElement).style.background = i < lit ? color : "";
      }
      if (split.current) {
        const sp = tel.split;
        const on = !!sp && now - sp.at < 2500;
        split.current.dataset.on = String(on);
        if (sp && on) {
          split.current.textContent = `${sp.delta >= 0 ? "+" : "−"}${fmt(Math.abs(sp.delta))}`;
          split.current.dataset.ahead = String(sp.delta >= 0);
        }
      }
      // The combo at risk, riding above the car.
      if (combo.current) {
        const at = tel.carScreen;
        const on = !!d && d.risk > 0 && !!at;
        combo.current.style.opacity = on ? "1" : "0";
        if (on && d && at) {
          const left = d.gap / DRIFT_SCORE.chainMax;
          const warn = left > 0.4;
          const shake = warn ? (left - 0.4) * 6 : 0;
          const jx = shake ? (Math.random() - 0.5) * shake : 0;
          const jy = shake ? (Math.random() - 0.5) * shake : 0;
          combo.current.style.transform = `translate(${at.x + jx}px, ${at.y - 96 + jy}px) translateX(-50%)`;
          combo.current.dataset.warn = String(warn);
          if (risk.current) risk.current.textContent = fmt(d.risk);
          if (mult.current) mult.current.textContent = `×${d.mult.toFixed(1)}`;
          if (chain.current) chain.current.style.transform = `scaleX(${d.drifting ? 1 : Math.max(0, 1 - left)})`;
        }
      }
      // The dash: angle blocks, speed, the drift key.
      const deg = d ? Math.min(ANGLE_MAX, d.angle) : 0;
      const at = Math.min(ANGLE_BLOCKS - 1, Math.floor((deg / ANGLE_MAX) * ANGLE_BLOCKS));
      if (angle.current) {
        const blocks = angle.current.children;
        for (let i = 0; i < blocks.length; i++) (blocks[i] as HTMLElement).dataset.on = String(!!d && d.angle > 1 && i <= at);
      }
      if (angleText.current) angleText.current.textContent = `${Math.round(deg)}°`;
      if (speed.current) speed.current.textContent = String(Math.round(Math.abs(tel.speed) * 3.6));
      if (speedBar.current) {
        const lit = Math.round(Math.min(1, Math.abs(tel.speed) / SPEED_TOP) * SPEED_BLOCKS);
        const blocks = speedBar.current.children;
        for (let i = 0; i < blocks.length; i++) (blocks[i] as HTMLElement).dataset.on = String(i < lit);
      }
      if (driftKey.current) driftKey.current.dataset.on = String(!!d?.drifting);
      if (feed.current) {
        const items = tel.feed.filter((f) => now - f.at < 2200);
        feed.current.innerHTML = items
          .map((f) => {
            const o = Math.max(0, 1 - (now - f.at) / 2200);
            const text = f.kind === "bank" ? `+${fmt(f.points)}` : f.kind === "lost" ? `Lost ${fmt(f.points)}` : `Clip +${fmt(f.points)}`;
            const color = f.kind === "bank" ? "#c8ff3a" : f.kind === "lost" ? "#ff6b6b" : "#ffcf33";
            return `<span style="opacity:${o};color:${color}">${text}</span>`;
          })
          .join("");
      }
      const h = hintState.current;
      if (h.on && d) {
        let want = h.step;
        if (h.step === 0 && d.drifting) want = 1;
        if (h.step === 1 && now - h.since > 3500) want = 2;
        if (h.step === 2 && now - h.since > 3500 && d.risk === 0) want = 3;
        if (want !== h.step) {
          h.step = want;
          h.since = now;
        }
        setHint((cur) => {
          const nx = h.step < HINTS.length ? h.step : null;
          return cur === nx ? cur : nx;
        });
      }
      const n = tel.countdown;
      const nextCue = n !== null && n > 0 ? String(n) : now - tel.goAt < 800 ? "Go" : "";
      setCue((c) => (c === nextCue ? c : nextCue));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // medals come from the spot, which doesn't change on the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel, p.boardScores]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 font-pixel uppercase">
      {cue && (
        <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2">
          <span key={cue} className="block animate-[race-slam_0.3s_ease-out_both] text-[140px] leading-none text-cream drop-shadow-[0_8px_0_rgba(0,0,0,0.6)]">
            {cue}
          </span>
        </div>
      )}

      {live && !hidden && (
        <>
          {/* Score, next medal, live rank */}
          <div className={`${HUD_BOX} absolute left-4 top-4 flex w-56 flex-col gap-2 px-4 py-3`}>
            <span className="flex items-center justify-between text-[9px] text-muted">
              <span>{p.spot.name}</span>
              <span ref={rank} className="text-cream" />
            </span>
            <span ref={score} className="text-3xl leading-none text-cream tabular-nums">
              0
            </span>
            <div className="flex flex-col gap-1">
              <span ref={goal} className="text-[9px] text-muted" />
              <div ref={goalBar} className="flex gap-[3px]" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="h-1.5 flex-1 bg-border" />
                ))}
              </div>
            </div>
          </div>

          <span
            ref={split}
            data-on="false"
            data-ahead="true"
            className="absolute left-1/2 top-5 -translate-x-1/2 border-[3px] border-bg px-3 py-1 text-base text-bg tabular-nums opacity-0 transition-opacity data-[ahead=false]:bg-[#ff6b6b] data-[ahead=true]:bg-lime data-[on=true]:opacity-100"
          />

          {/* Combo at risk, above the car */}
          <div ref={combo} data-warn="false" className="group absolute left-0 top-0 flex flex-col items-center gap-1 opacity-0">
            <span className={`${HUD_BOX} flex items-baseline gap-2 px-2.5 py-1`}>
              <span ref={risk} className="text-lg text-cream tabular-nums group-data-[warn=true]:text-[#ff9a3c]" />
              <span ref={mult} className="text-xs text-lime tabular-nums" />
            </span>
            <span className="block h-1.5 w-24 border border-bg bg-bg/60">
              <span ref={chain} className="block h-full w-full origin-left bg-lime group-data-[warn=true]:bg-[#ff9a3c]" />
            </span>
          </div>

          <div ref={feed} className="absolute right-8 top-[38%] flex flex-col items-end gap-1 text-xl tabular-nums drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]" />

          {hint !== null && (
            <div className="absolute bottom-32 left-1/2 flex -translate-x-1/2 animate-[fade-in_0.25s_ease-out] items-center gap-3">
              {HINTS[hint].keys.map((k) => (
                <Key key={k}>{k}</Key>
              ))}
              <span className="text-sm text-cream drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">{HINTS[hint].text}</span>
            </div>
          )}

          {/* The dash */}
          <div className="absolute inset-x-0 bottom-4 flex justify-center">
            <div className={`${HUD_BOX} flex items-stretch divide-x-[3px] divide-border`}>
              <div className="flex flex-col justify-center gap-1.5 px-4 py-2">
                <span className="flex items-baseline justify-between text-[9px] text-muted">
                  <span>Angle</span>
                  <span ref={angleText} className="text-cream tabular-nums">
                    0°
                  </span>
                </span>
                <div ref={angle} className="flex gap-[3px]" aria-hidden>
                  {Array.from({ length: ANGLE_BLOCKS }, (_, i) => {
                    const band = angleBand(i);
                    const on = band === "dead" ? "data-[on=true]:bg-muted" : band === "ideal" ? "data-[on=true]:bg-lime" : "data-[on=true]:bg-[#ff6b6b]";
                    const off = band === "ideal" ? "bg-lime/15" : band === "over" ? "bg-[#ff6b6b]/15" : "bg-border";
                    return <span key={i} data-on="false" className={`h-3 w-2 ${off} ${on}`} />;
                  })}
                </div>
              </div>
              <div className="flex flex-col justify-center gap-1.5 px-4 py-2">
                <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                  <span ref={speed} className="w-[3ch] text-right text-2xl leading-none text-cream">
                    0
                  </span>
                  <span className="text-[9px] text-muted">km/h</span>
                </div>
                <div ref={speedBar} className="flex gap-[3px]" aria-hidden>
                  {Array.from({ length: SPEED_BLOCKS }, (_, i) => (
                    <span key={i} data-on="false" className="h-2 w-2 bg-border data-[on=true]:bg-lime" />
                  ))}
                </div>
              </div>
              <div ref={driftKey} data-on="false" className="group flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors data-[on=true]:bg-lime/10">
                <span className="border-2 border-border px-2 py-0.5 text-[10px] text-cream transition-colors group-data-[on=true]:border-lime group-data-[on=true]:text-lime group-data-[on=true]:shadow-[0_0_12px_rgba(200,255,58,0.5)]">
                  Space
                </span>
                <span className="text-[9px] text-muted group-data-[on=true]:text-lime">Drift</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Buttons, the town's group */}
      {p.ready && !hidden && p.stage !== "menu" && (
        <div className={`${HUD_BOX} absolute right-4 top-4 flex divide-x-[3px] divide-border text-cream`}>
          <button type="button" onClick={p.onToggleGhosts} title="Ghosts (G)" className={`px-3 py-2 ${p.showGhosts ? "" : "text-muted"}`}>
            <GhostIcon size={16} />
          </button>
          <button type="button" onClick={p.onToggleCamera} title="Camera (C)" className="px-3 py-2">
            <Camera size={16} />
          </button>
          <button type="button" onClick={p.onToggleMute} title="Sound" className="px-3 py-2">
            {p.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button type="button" onClick={() => p.onPause(true)} title="Pause (Esc)" className="flex items-center gap-2 px-3 py-2 text-[10px]">
            <X size={14} /> Exit
          </button>
        </div>
      )}

      {p.paused && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-bg/60 backdrop-blur-md">
          <div className="flex flex-col gap-6 px-6">
            <h2 className="text-2xl tracking-[0.2em] text-cream sm:text-4xl sm:tracking-[0.25em]">Paused</h2>
            <div className="flex w-72 flex-col gap-2 text-[11px]">
              <button type="button" onClick={() => p.onPause(false)} className="flex items-center gap-3 bg-lime px-3 py-2.5 text-bg">
                <span className="border-2 border-bg px-1">Esc</span> Resume
              </button>
              <button type="button" onClick={() => { p.onPause(false); p.onRestart(); }} className="flex items-center gap-3 border-2 border-border px-3 py-2.5 text-cream hover:text-lime">
                <span className="border-2 border-border px-1">R</span> Start over
              </button>
              {p.stage === "run" && (
                <button type="button" onClick={() => { p.onPause(false); p.onRespawn(); }} className="flex items-center gap-3 border-2 border-border px-3 py-2.5 text-cream hover:text-lime">
                  <span className="border-2 border-border px-1">Enter</span> Last checkpoint
                </button>
              )}
              <button type="button" onClick={p.onExit} className="flex items-center gap-3 border-2 border-border px-3 py-2.5 text-cream hover:text-lime">
                <span className="border-2 border-border px-1">Q</span> Back to spots
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
