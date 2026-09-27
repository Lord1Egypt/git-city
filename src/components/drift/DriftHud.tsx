"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Ghost as GhostIcon, LogOut, Volume2, VolumeX } from "lucide-react";
import { HUD_BOX } from "@/components/league/hud/shared";
import type { TrialStage } from "@/lib/league-city/race/trial";
import { DRIFT_SCORE } from "@/lib/drift/score";
import { medalScores, type LiveSpot, type Medal } from "@/lib/drift/spots/types";
import type { DriftTelemetry } from "@/lib/drift/telemetry";
import { markSeen, seen } from "@/lib/drift/local";

// The drift HUD, in the race HUD's language. Top center: the banked score and
// the split against the ghost you race. Next to the car: the combo at risk,
// its multiplier and how long you have to link the next drift (white, then
// orange and shaking as it runs out: Absolute Drift, NFSU). Bottom: the drift
// angle against its bands, so a drift that scores nothing never looks like
// one that does (Forza Horizon 6's top complaint), and the speed. Right: what
// just banked, got lost or clipped. H hides all of it, G the ghosts.

export const MEDAL_COLORS: Record<Medal, string> = { author: "#3ddc6b", gold: "#ffcf33", silver: "#cfd8e3", bronze: "#d98a4e" };

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const ANGLE_MAX = 90;
const HINTS = [
  { key: "start", text: "Hold Space and steer to drift" },
  { key: "angle", text: "Steer into the drift to open the angle, against it to close it" },
  { key: "bank", text: "Straighten out to bank the combo. A wall loses it" },
] as const;

export interface DriftHudProps {
  spot: LiveSpot;
  telemetry: DriftTelemetry;
  ready: boolean;
  stage: TrialStage;
  paused: boolean;
  muted: boolean;
  showGhosts: boolean;
  /** Your best on this spot (the board or this browser), and where it ranks. */
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

export default function DriftHud(p: DriftHudProps) {
  const { telemetry: tel } = p;
  const score = useRef<HTMLSpanElement>(null);
  const split = useRef<HTMLSpanElement>(null);
  const combo = useRef<HTMLDivElement>(null);
  const risk = useRef<HTMLSpanElement>(null);
  const mult = useRef<HTMLSpanElement>(null);
  const chain = useRef<HTMLSpanElement>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const angleText = useRef<HTMLSpanElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const rank = useRef<HTMLSpanElement>(null);
  const goal = useRef<HTMLSpanElement>(null);
  const goalBar = useRef<HTMLSpanElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const [cue, setCue] = useState("");
  const [hidden, setHidden] = useState(false);
  const [hint, setHint] = useState<number | null>(null);

  const medals = medalScores(p.spot);
  const live = p.ready && (p.stage === "countdown" || p.stage === "run");

  // H hides the HUD, G the ghosts.
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

  // First run on the first spot: three hints, each when it applies (no tutorial stage).
  const hintState = useRef({ on: false, step: 0, since: 0 });
  useEffect(() => {
    const h = hintState.current;
    if (p.stage === "run" && !seen("hints")) {
      h.on = true;
    } else if (p.stage === "finish" && h.on) {
      h.on = false;
      markSeen("hints");
      setHint(null);
    }
  }, [p.stage]);

  // Numbers from the telemetry every animation frame.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const d = tel.drift;
      const now = performance.now();
      const total = d ? d.score : 0;
      if (score.current) score.current.textContent = fmt(total);
      if (split.current) {
        const sp = tel.split;
        const on = !!sp && now - sp.at < 2500;
        split.current.dataset.on = String(on);
        if (sp && on) {
          split.current.textContent = `${sp.delta >= 0 ? "+" : "−"}${fmt(Math.abs(sp.delta))}`;
          split.current.dataset.ahead = String(sp.delta >= 0);
        }
      }
      // The combo rides above the car while there's one at risk.
      if (combo.current) {
        const at = tel.carScreen;
        const on = !!d && d.risk > 0 && !!at;
        combo.current.style.opacity = on ? "1" : "0";
        if (on && d && at) {
          const left = d.gap / DRIFT_SCORE.chainMax;
          const shake = left > 0.4 ? (left - 0.4) * 6 : 0;
          const jx = shake ? (Math.random() - 0.5) * shake : 0;
          const jy = shake ? (Math.random() - 0.5) * shake : 0;
          combo.current.style.transform = `translate(${at.x + jx}px, ${at.y - 90 + jy}px) translateX(-50%)`;
          combo.current.dataset.warn = String(left > 0.4);
          if (risk.current) risk.current.textContent = fmt(d.risk);
          if (mult.current) mult.current.textContent = `×${d.mult.toFixed(1)}`;
          if (chain.current) chain.current.style.transform = `scaleX(${d.drifting ? 1 : Math.max(0, 1 - left)})`;
        }
      }
      if (needle.current && d) {
        needle.current.style.left = `${(Math.min(ANGLE_MAX, d.angle) / ANGLE_MAX) * 100}%`;
        needle.current.dataset.band = d.band;
      }
      if (angleText.current) angleText.current.textContent = d ? `${Math.round(d.angle)}°` : "0°";
      if (speed.current) speed.current.textContent = String(Math.round(Math.abs(tel.speed) * 3.6));
      // Live rank on the world board, and the next medal.
      const running = total + (d?.risk ?? 0);
      if (rank.current) {
        const above = p.boardScores.filter((s) => s > running).length;
        rank.current.textContent = p.boardScores.length === 0 ? "" : above >= p.boardScores.length ? `#${p.boardScores.length}+` : `#${above + 1}`;
      }
      const next = [...medals].reverse().find(([, at]) => at > total) ?? null;
      if (goal.current) goal.current.textContent = next ? `${next[0]} ${fmt(next[1])}` : "Author beaten";
      if (goalBar.current) {
        goalBar.current.style.transform = `scaleX(${next ? Math.min(1, total / next[1]) : 1})`;
        goalBar.current.style.background = next ? MEDAL_COLORS[next[0]] : MEDAL_COLORS.author;
      }
      if (feed.current) {
        const items = tel.feed.filter((f) => now - f.at < 2200);
        feed.current.innerHTML = items
          .map((f) => {
            const o = Math.max(0, 1 - (now - f.at) / 2200);
            const text = f.kind === "bank" ? `+${fmt(f.points)}` : f.kind === "lost" ? `Lost ${fmt(f.points)}` : `Clip +${fmt(f.points)}`;
            const color = f.kind === "bank" ? "#3ddc6b" : f.kind === "lost" ? "#ff5a5a" : "#ffcf33";
            return `<span style="opacity:${o};color:${color}">${text}</span>`;
          })
          .join("");
      }
      // Hints.
      const h = hintState.current;
      if (h.on && d) {
        let want = h.step;
        if (h.step === 0 && d.drifting) want = 1;
        if (h.step === 1 && now - h.since > 4000) want = 2;
        if (h.step === 2 && now - h.since > 4000 && d.risk === 0) want = 3;
        if (want !== h.step) {
          h.step = want;
          h.since = now;
        }
        setHint((cur) => {
          const next = h.step < HINTS.length ? h.step : null;
          return cur === next ? cur : next;
        });
      }
      const n = tel.countdown;
      const nextCue = n !== null && n > 0 ? String(n) : now - tel.goAt < 800 ? "Go" : "";
      setCue((c) => (c === nextCue ? c : nextCue));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // medals come from the spot, which doesn't change on the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel, p.boardScores]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 font-pixel uppercase">
      {cue && (
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-7xl text-cream drop-shadow-[0_4px_0_#000]">{cue}</div>
      )}

      {live && !hidden && (
        <>
          {/* Banked score and split */}
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1.5">
            <div className={`${HUD_BOX} flex flex-col items-center px-5 py-2`}>
              <span className="text-[9px] text-muted">{p.spot.name}</span>
              <span ref={score} className="text-3xl text-cream tabular-nums">
                0
              </span>
            </div>
            <span
              ref={split}
              data-on="false"
              data-ahead="true"
              className="border-[3px] border-bg px-3 py-1 text-base text-white tabular-nums opacity-0 transition-opacity data-[ahead=false]:bg-[#e0323c] data-[ahead=true]:bg-[#1f9d55] data-[on=true]:opacity-100"
            />
          </div>

          {/* Next medal and live rank */}
          <div className={`${HUD_BOX} absolute left-4 top-4 flex w-44 flex-col gap-1.5 px-3 py-2`}>
            <span className="flex justify-between text-[9px] text-muted">
              <span>Next</span>
              <span ref={rank} className="text-cream" />
            </span>
            <span ref={goal} className="text-[10px] text-cream" />
            <span className="block h-1.5 w-full bg-border">
              <span ref={goalBar} className="block h-full w-full origin-left" />
            </span>
            {p.best !== null && <span className="text-[9px] normal-case text-muted">Your best {fmt(p.best)}</span>}
          </div>

          {/* Combo at risk, riding above the car */}
          <div
            ref={combo}
            data-warn="false"
            className="absolute left-0 top-0 flex flex-col items-center gap-0.5 opacity-0 data-[warn=true]:[&_.risk]:text-[#ff9f1c]"
          >
            <span className="flex items-baseline gap-2 drop-shadow-[0_2px_0_#000]">
              <span ref={risk} className="risk text-xl text-white tabular-nums" />
              <span ref={mult} className="text-sm text-lime tabular-nums" />
            </span>
            <span className="block h-1 w-20 bg-black/50">
              <span ref={chain} className="block h-full w-full origin-left bg-white" />
            </span>
          </div>

          {/* Feed */}
          <div ref={feed} className="absolute right-6 top-1/3 flex flex-col items-end gap-1 text-lg tabular-nums drop-shadow-[0_2px_0_#000]" />

          {/* Angle meter and speed */}
          <div className={`${HUD_BOX} absolute bottom-4 left-1/2 flex w-72 -translate-x-1/2 flex-col gap-1 px-3 py-2`}>
            <span className="flex justify-between text-[9px] text-muted">
              <span>Angle</span>
              <span ref={angleText} className="text-cream tabular-nums" />
            </span>
            <span className="relative block h-2.5 w-full">
              <span className="absolute inset-y-0 left-0 bg-border" style={{ width: `${(DRIFT_SCORE.minAngle / ANGLE_MAX) * 100}%` }} />
              <span
                className="absolute inset-y-0 bg-[#1f9d55]"
                style={{ left: `${(DRIFT_SCORE.minAngle / ANGLE_MAX) * 100}%`, width: `${((DRIFT_SCORE.maxAngle - DRIFT_SCORE.minAngle) / ANGLE_MAX) * 100}%` }}
              />
              <span className="absolute inset-y-0 right-0 bg-[#e0323c]" style={{ width: `${((ANGLE_MAX - DRIFT_SCORE.maxAngle) / ANGLE_MAX) * 100}%` }} />
              <span ref={needle} className="absolute -inset-y-1 w-1 -translate-x-1/2 bg-white shadow-[0_0_0_1px_#000]" style={{ left: "0%" }} />
            </span>
          </div>
          <div className={`${HUD_BOX} absolute bottom-4 right-4 flex items-baseline gap-1 px-3 py-2`}>
            <span ref={speed} className="text-2xl text-cream tabular-nums">
              0
            </span>
            <span className="text-[9px] text-muted">km/h</span>
          </div>

          {hint !== null && (
            <div className={`${HUD_BOX} absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 text-[10px] normal-case text-cream`}>{HINTS[hint].text}</div>
          )}
        </>
      )}

      {/* Buttons */}
      {p.ready && !hidden && (
        <div className="absolute right-4 top-4 flex gap-2">
          <button type="button" onClick={p.onToggleGhosts} title="Ghosts (G)" className={`${HUD_BOX} p-2 ${p.showGhosts ? "text-cream" : "text-muted"}`}>
            <GhostIcon size={16} />
          </button>
          <button type="button" onClick={p.onToggleCamera} title="Camera (C)" className={`${HUD_BOX} p-2 text-cream`}>
            <Camera size={16} />
          </button>
          <button type="button" onClick={p.onToggleMute} title="Sound" className={`${HUD_BOX} p-2 text-cream`}>
            {p.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button type="button" onClick={() => p.onPause(true)} title="Pause (Esc)" className={`${HUD_BOX} p-2 text-cream`}>
            <LogOut size={16} />
          </button>
        </div>
      )}

      {p.paused && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60">
          <div className={`${HUD_BOX} flex w-64 flex-col gap-2 p-4 text-[11px]`}>
            <span className="mb-1 text-center text-xs text-cream">Paused</span>
            <button type="button" onClick={() => p.onPause(false)} className="btn-press border-2 border-lime px-3 py-2 text-lime">
              Resume
            </button>
            <button type="button" onClick={() => { p.onPause(false); p.onRestart(); }} className="btn-press border-2 border-border px-3 py-2 text-cream">
              Restart <span className="text-muted">R</span>
            </button>
            {p.stage === "run" && (
              <button type="button" onClick={() => { p.onPause(false); p.onRespawn(); }} className="btn-press border-2 border-border px-3 py-2 text-cream">
                Last checkpoint <span className="text-muted">Enter</span>
              </button>
            )}
            <button type="button" onClick={p.onExit} className="btn-press border-2 border-border px-3 py-2 text-cream">
              Back to spots <span className="text-muted">Esc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
