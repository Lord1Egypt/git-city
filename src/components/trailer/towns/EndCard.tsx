"use client";

import EndCard from "@/components/trailer/EndCard";
import { BEAT, BUMP, BUTTON_AT, LENGTH, LOGO } from "@/lib/trailer/towns/teaser";
import type { FilmClock } from "@/lib/trailer/clock";

// The Towns teaser's end card: GIT CITY stamped on, TOWNS stamped on its
// corner, COMING SOON, and the orange car honking at the Y.

export default function TownsEndCard({ clock }: { clock: FilmClock }) {
  return (
    <EndCard
      clock={clock}
      beat={BEAT}
      start={LOGO}
      end={LENGTH}
      words={[
        ["GIT", "#e8dcc8"],
        ["CITY", "#c8e64a"],
      ]}
      stamp={{ text: "TOWNS", color: "#e07a4f" }}
      line="COMING SOON"
      car={{ color: "#e07a4f", stopX: 73.5 }}
      at={{ name: 1, stamp: 3, line: 5, button: BUTTON_AT, bump: BUMP }}
    />
  );
}
