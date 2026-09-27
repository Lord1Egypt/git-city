"use client";

import { useEffect, useRef, useState } from "react";
import { HUD_BOX } from "@/components/league/hud/shared";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import { medalFor, medalScores, type LiveSpot } from "@/lib/drift/spots/types";
import { MEDAL_COLORS, fmt } from "./DriftHud";

// Past the line, in Trackmania's order: FINISH, then the score counts up,
// then the medal, where it ranks in the world and your country, who it
// passed, and the next thing to chase (a medal, or the driver just above,
// with their ghost a key away). A run worse than your best gets no fanfare,
// just the gap. Retry has the focus and R or Enter takes it in one press.

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
  /** Your best before this run (board or browser), or null on a first run. */
  before: number | null;
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
  const retry = useRef<HTMLButtonElement>(null);
  const better = p.before === null || p.score > p.before;
  const medal = medalFor(p.spot, p.score);
  const medals = medalScores(p.spot);
  const nextMedal = [...medals].reverse().find(([, at]) => at > p.score) ?? null;

  // 0 FINISH · 1 panel and count-up · 2 medal · 3 ranks · 4 passed and next goal.
  useEffect(() => {
    const ts = [1200, 2400, 3000, 3600].map((ms, i) => setTimeout(() => setBeat(i + 1), ms));
    return () => ts.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (beat < 1) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 1000);
      setShown(Math.round(p.score * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    retry.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, [beat >= 1, p.score]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once the panel shows

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
  const signIn = async () => {
    await signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?next=/drift/${p.spot.id}`);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-40 font-pixel uppercase">
      {beat === 0 && <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-6xl text-cream drop-shadow-[0_4px_0_#000]">Finish</div>}

      {beat >= 1 && (
        <div className={`${HUD_BOX} absolute right-6 top-1/2 flex w-80 -translate-y-1/2 flex-col gap-3 p-5`}>
          <span className="text-[10px] text-muted">{p.spot.name}</span>
          <span className="text-4xl text-cream tabular-nums">{fmt(shown)}</span>

          {beat >= 2 && (
            <span className="text-[11px]" style={{ color: medal ? MEDAL_COLORS[medal] : undefined }}>
              {medal ? `${medal} medal` : "No medal yet"}
              {!better && p.before !== null && <span className="ml-2 normal-case text-muted">{fmt(p.before - p.score)} short of your best</span>}
              {better && p.before !== null && <span className="ml-2 text-lime">New best</span>}
            </span>
          )}

          {beat >= 3 && (
            <div className="flex flex-col gap-1 text-[10px]">
              {p.post.status === "posting" && <span className="text-muted">Posting…</span>}
              {p.post.status === "failed" && (
                <span className="pointer-events-auto flex items-center justify-between text-[#ff9f1c]">
                  Not posted yet
                  <button type="button" onClick={p.onRetryPost} className="btn-press border-2 border-border px-2 py-0.5 text-cream">
                    Try again
                  </button>
                </span>
              )}
              {p.post.status === "signed-out" && (
                <button type="button" onClick={signIn} className="btn-press pointer-events-auto border-2 border-lime px-3 py-2 text-left normal-case text-lime">
                  Sign in with GitHub to post {fmt(p.score)}
                </button>
              )}
              {r && (
                <>
                  <span className="flex justify-between text-cream">
                    <span>World</span>
                    <span className="tabular-nums">
                      #{r.rankWorld} <span className="text-muted">of {fmt(r.totalWorld)}</span>
                    </span>
                  </span>
                  {r.country && (
                    <span className="flex justify-between text-cream">
                      <span>{flag(r.country)} {r.country}</span>
                      <span className="tabular-nums">
                        #{r.rankCountry} <span className="text-muted">of {fmt(r.totalCountry)}</span>
                      </span>
                    </span>
                  )}
                  {!r.improved && <span className="normal-case text-muted">Your best stays {fmt(r.best)}</span>}
                </>
              )}
            </div>
          )}

          {beat >= 4 && (
            <div className="flex flex-col gap-1 text-[10px] normal-case">
              {r && r.passed.length > 0 && <span className="text-lime">Passed {r.passed.map((l) => `@${l}`).join(", ")}</span>}
              {r?.next ? (
                <button type="button" onClick={() => p.onRaceGhost(r.next!.login)} className="btn-press pointer-events-auto border-2 border-border px-3 py-2 text-left text-cream">
                  @{r.next.login} is {fmt(r.next.score - r.best)} above you. Race their ghost
                </button>
              ) : nextMedal ? (
                <span className="text-muted">
                  {nextMedal[0]} at {fmt(nextMedal[1])}
                </span>
              ) : null}
            </div>
          )}

          <div className="pointer-events-auto mt-1 flex flex-col gap-2 text-[11px]">
            <button ref={retry} type="button" onClick={p.onRetry} className="btn-press border-2 border-lime px-3 py-2 text-lime focus:outline-none">
              Retry <span className="text-muted">R</span>
            </button>
            <div className="flex gap-2">
              {p.you && (
                <button type="button" onClick={challenge} className="btn-press flex-1 border-2 border-border px-3 py-2 text-cream">
                  {copied ? "Link copied" : "Challenge"}
                </button>
              )}
              <button type="button" onClick={p.onSpots} className="btn-press flex-1 border-2 border-border px-3 py-2 text-cream">
                Spots
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
