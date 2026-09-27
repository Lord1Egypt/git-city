"use client";

import { useEffect, useState } from "react";
import { useTouch } from "@/components/towns/useDesktop";
import DriftResults from "@/components/drift/DriftResults";
import DriftHud from "@/components/drift/DriftHud";
import { createDriftTelemetry } from "@/lib/drift/telemetry";
import type { DriftState } from "@/lib/drift/score";
import { getLiveSpot } from "@/lib/drift/spots";
import type { LiveSpot } from "@/lib/drift/spots/types";

const BOARD = [
  { rank: 1, login: "sindresorhus", score: 71_200 },
  { rank: 2, login: "gaearon", score: 57_900 },
  { rank: 3, login: "octocat", score: 55_020 },
  { rank: 4, login: "torvalds", score: 54_300 },
  { rank: 5, login: "yyx990803", score: 41_000 },
];

const STATE: DriftState = {
  t: 20_000, score: 38_210, risk: 12_480, mult: 4.2, gap: 0, angle: 42, band: "ideal", kmh: 74, drifting: true, braking: false,
  hint: null, progress: 300, splits: [], finished: false, events: [],
};

/** ?hud=combo|warn|bank|hint: the driving HUD in one state, over a still frame. */
function HudPreview({ mode }: { mode: string }) {
  const spot = getLiveSpot("harbor") as LiveSpot;
  const touch = useTouch();
  const [tel] = useState(() => {
    const t = createDriftTelemetry();
    t.speed = 74 / 3.6;
    t.drift = { ...STATE };
    if (mode === "warn") t.drift = { ...STATE, drifting: false, gap: 1.6 };
    if (mode === "hint") t.drift = { ...STATE, risk: 0, drifting: false, hint: "shallow", angle: 7 };
    if (mode === "bank") t.feed = [{ kind: "bank", points: 12_480, at: 1e12 }];
    return t;
  });
  useEffect(() => {
    if (mode !== "bank") return;
    const id = setInterval(() => (tel.feed = [{ kind: "bank", points: 12_480, at: performance.now() - 100 }]), 50);
    return () => clearInterval(id);
  }, [mode, tel]);
  const noop = () => {};
  return (
    <div className="fixed inset-0 bg-[url('/models/drift/preview-bg.jpg')] bg-cover">
      <DriftHud touch={touch} spot={spot} telemetry={tel} ready stage="run" paused={false} muted={false} showGhosts best={19_535} boardScores={[71_200, 57_900, 55_020, 54_300, 41_000]} onToggleGhosts={noop} onToggleMute={noop} onToggleCamera={noop} onPause={noop} onRestart={noop} onRespawn={noop} onExit={noop} />
    </div>
  );
}

// ?out shows a signed-out run; ?hud=… the driving HUD instead.
export default function UiPreview() {
  const spot = getLiveSpot("harbor") as LiveSpot;
  const [out, setOut] = useState(false);
  const [hud, setHud] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(window.location.search);
      setOut(q.has("out"));
      setHud(q.get("hud"));
    };
    read();
  }, []);
  if (hud) return <HudPreview mode={hud} />;
  return (
    <div className="fixed inset-0 bg-[url('/models/drift/preview-bg.jpg')] bg-cover">
      <DriftResults
        spot={spot}
        score={55_410}
        before={48_120}
        stats={{ banks: 14, lost: 2, clips: 2, bestChain: 9_840 }}
        post={
          out
            ? { status: "signed-out" }
            : {
                status: "posted",
                result: {
                  score: 55_410, best: 55_410, improved: true, rankWorld: 3, rankCountry: 2, totalWorld: 318, totalCountry: 41, country: "BR",
                  passed: ["octocat", "torvalds"], next: { login: "gaearon", score: 57_900, rank: 2 },
                  around: [
                    { rank: 1, login: "sindresorhus", score: 71_200 },
                    { rank: 2, login: "gaearon", score: 57_900 },
                    { rank: 3, login: "srizzon", score: 55_410 },
                    { rank: 4, login: "octocat", score: 55_020 },
                    { rank: 5, login: "torvalds", score: 54_300 },
                  ],
                },
              }
        }
        you={out ? null : "srizzon"}
        board={BOARD}
        onRetry={() => {}}
        onRetryPost={() => {}}
        onRaceGhost={() => {}}
        onSpots={() => {}}
      />
    </div>
  );
}
