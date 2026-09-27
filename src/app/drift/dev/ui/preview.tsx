"use client";

import DriftResults from "@/components/drift/DriftResults";
import { getLiveSpot } from "@/lib/drift/spots";
import type { LiveSpot } from "@/lib/drift/spots/types";

export default function UiPreview() {
  const spot = getLiveSpot("harbor") as LiveSpot;
  return (
    <div className="fixed inset-0 bg-[#0b1a33]">
      <DriftResults
        spot={spot}
        score={55_410}
        before={48_120}
        stats={{ banks: 14, lost: 2, clips: 2, bestChain: 9_840 }}
        post={{ status: "posted", result: { score: 55_410, best: 55_410, improved: true, rankWorld: 12, rankCountry: 2, totalWorld: 318, totalCountry: 41, country: "BR", passed: ["octocat", "torvalds"], next: { login: "gaearon", score: 57_900, rank: 11 } } }}
        you="srizzon"
        onRetry={() => {}}
        onRetryPost={() => {}}
        onRaceGhost={() => {}}
        onSpots={() => {}}
      />
    </div>
  );
}
