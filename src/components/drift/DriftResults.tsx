"use client";

import { useEffect, useRef, useState } from "react";
import { HUD_BOX } from "@/components/league/hud/shared";
import { carColor } from "@/lib/league-city/drive/net";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import { medalFor, medalScores, type LiveSpot } from "@/lib/drift/spots/types";
import { MEDAL_COLORS, fmt } from "./DriftHud";

// Past the line, the race card's pattern, in Trackmania's order: FINISH, the
// score counting up, the medal slamming on, where it ranks in the world and
// your country, who it passed, and the next thing to chase (the driver just
// above, with their ghost a key away, or the next medal). A run worse than
// your best gets no fanfare, just the gap. Again has the focus: R or Enter.

export interface PostResult {
  score: number;
  best: number;
  improved: boolean;
  rankWorld: number;
  rankCountry: number;
  totalWorld: number;
  totalCountry: number;
  country: string | null;
  passed: string[];
  next: { login: string; score: number; rank: number } | null;
}

export type PostState =
  | { status: "posting" }
  | { status: "posted"; result: PostResult }
  | { status: "failed" }
  | { status: "signed-out" };

export interface DriftResultsProps {
  spot: LiveSpot;
  score: number;
  before: number | null;
  /** Banks, drifts lost and clipping points hit in the run. */
  stats: { banks: number; lost: number; clips: number; bestChain: number };
  post: PostState;
  you: string | null;
  onRetry: () => void;
  onRetryPost: () => void;
  onRaceGhost: (login: string) => void;
  onSpots: () => void;
}

const flag = (cc: string | null) => (cc ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");

export default function DriftResults(p: DriftResultsProps) {
  const [beat, setBeat] = useState(0);
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  const again = useRef<HTMLButtonElement>(null);
  const better = p.before === null || p.score > p.before;
  const medal = medalFor(p.spot, p.score);
  const nextMedal = [...medalScores(p.spot)].reverse().find(([, at]) => at > p.score) ?? null;

  // 0 FINISH · 1 card and count-up · 2 medal · 3 ranks and what's next.
  useEffect(() => {
    const ts = [1300, 2500, 3100].map((ms, i) => setTimeout(() => setBeat(i + 1), ms));
    return () => ts.forEach(clearTimeout);
  }, []);
  const showing = beat >= 1;
  useEffect(() => {
    if (!showing) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 1000);
      setShown(Math.round(p.score * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    again.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, [showing, p.score]);

  const cb = useRef(p);
  useEffect(() => {
    cb.current = p;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyR" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        cb.current.onRetry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const r = p.post.status === "posted" ? p.post.result : null;
  const challenge = () => {
    if (!p.you) return;
    const url = `${window.location.origin}/drift/${p.spot.id}?vs=${encodeURIComponent(p.you)}`;
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const signIn = () => void signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?next=/drift/${p.spot.id}`);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 font-pixel uppercase">
      {beat === 0 && (
        <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2">
          <span className="block animate-[race-slam_0.3s_ease-out_both] text-6xl tracking-[0.2em] text-cream drop-shadow-[0_5px_0_rgba(0,0,0,0.6)]">Finish</span>
        </div>
      )}

      {showing && (
        <section className={`${HUD_BOX} pointer-events-auto absolute right-[6vw] top-1/2 w-[380px] max-w-[calc(100vw-2rem)] animate-[race-card-in_0.35s_ease-out_both] px-5 py-4`} style={{ transform: "translateY(-50%)" }}>
          <div className="flex items-start justify-between">
            <p className="text-[11px] text-muted">{p.spot.name}</p>
            {beat >= 2 && medal && (
              <span className="animate-[race-slam_0.3s_ease-out_both] border-[3px] px-2 py-0.5 text-[11px]" style={{ borderColor: MEDAL_COLORS[medal], color: MEDAL_COLORS[medal] }}>
                {medal}
              </span>
            )}
          </div>
          <p className="mt-2 text-4xl text-cream tabular-nums">{fmt(shown)}</p>
          <p className="mt-2 flex items-center gap-3 text-xs tabular-nums">
            {beat >= 2 && better && p.before !== null && <span className="animate-pulse bg-lime px-2 py-0.5 text-bg">New best</span>}
            {beat >= 2 && !better && p.before !== null && <span className="text-[#ff6b6b]">−{fmt(p.before - p.score)} to your best</span>}
            {beat >= 2 && p.before === null && <span className="text-lime">First run</span>}
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t-2 border-border pt-3 text-[10px] tabular-nums">
            <li className="flex justify-between"><span className="text-muted">Banked</span><span className="text-cream">{p.stats.banks}</span></li>
            <li className="flex justify-between"><span className="text-muted">Lost</span><span className={p.stats.lost ? "text-[#ff6b6b]" : "text-cream"}>{p.stats.lost}</span></li>
            <li className="flex justify-between"><span className="text-muted">Clips</span><span className="text-cream">{p.stats.clips}</span></li>
            <li className="flex justify-between"><span className="text-muted">Best chain</span><span className="text-cream">{fmt(p.stats.bestChain)}</span></li>
          </ul>

          {beat >= 3 && (
            <div className="mt-3 flex flex-col gap-2 text-[11px]">
              {p.post.status === "posting" && <p className="text-muted">Posting…</p>}
              {p.post.status === "failed" && (
                <p className="flex items-center justify-between border-2 border-[#ff9a3c] px-3 py-2 text-[#ff9a3c]">
                  Not posted yet
                  <button type="button" onClick={p.onRetryPost} className="border-2 border-border px-2 py-0.5 text-[10px] text-cream hover:text-lime">
                    Try again
                  </button>
                </p>
              )}
              {p.post.status === "signed-out" && (
                <button type="button" onClick={signIn} className="flex items-center justify-between border-2 border-lime px-3 py-2 text-left text-lime">
                  <span>Sign in to post {fmt(p.score)}</span>
                  <span className="text-[9px] normal-case">GitHub →</span>
                </button>
              )}
              {r && (
                <>
                  <p className="flex gap-5 text-muted">
                    <span>
                      World <span className="text-cream">#{r.rankWorld}</span> <span className="text-dim">/ {fmt(r.totalWorld)}</span>
                    </span>
                    {r.country && (
                      <span>
                        {flag(r.country)} <span className="text-cream">#{r.rankCountry}</span> <span className="text-dim">/ {fmt(r.totalCountry)}</span>
                      </span>
                    )}
                  </p>
                  {r.passed.length > 0 && <p className="normal-case text-lime">Passed {r.passed.map((l) => `@${l}`).join(", ")}</p>}
                  {r.next && (
                    <button type="button" onClick={() => p.onRaceGhost(r.next!.login)} className="flex items-center justify-between border-2 border-border px-3 py-2 text-left hover:border-lime">
                      <span className="normal-case" style={{ color: carColor(r.next.login) }}>
                        @{r.next.login} · #{r.next.rank}
                      </span>
                      <span className="text-[10px] text-cream">+{fmt(r.next.score - r.best)} · race ghost</span>
                    </button>
                  )}
                </>
              )}
              {!r?.next && nextMedal && (
                <p className="flex justify-between text-muted">
                  <span>Next</span>
                  <span style={{ color: MEDAL_COLORS[nextMedal[0]] }}>
                    {nextMedal[0]} {fmt(nextMedal[1])}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              ref={again}
              type="button"
              onClick={p.onRetry}
              className="flex items-center justify-center gap-2 bg-lime px-3 py-2.5 text-[11px] text-bg outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cream active:translate-y-px"
            >
              <span className="border-2 border-bg px-1">R</span> Again
            </button>
            {p.you ? (
              <button type="button" onClick={challenge} className="flex items-center justify-center gap-2 border-2 border-border px-3 py-2.5 text-[11px] text-cream transition-colors hover:text-lime">
                {copied ? "Link copied" : "Challenge"}
              </button>
            ) : (
              <button type="button" onClick={p.onSpots} className="flex items-center justify-center gap-2 border-2 border-border px-3 py-2.5 text-[11px] text-cream transition-colors hover:text-lime">
                Spots
              </button>
            )}
          </div>
          {p.you && (
            <button type="button" onClick={p.onSpots} className="mt-2 w-full text-center text-[10px] text-muted hover:text-lime">
              Back to spots
            </button>
          )}
        </section>
      )}
    </div>
  );
}
