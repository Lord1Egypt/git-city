"use client";

import EndCard from "@trailer-kit/examples/gitcity/EndCard";
import type { FilmClock } from "@trailer-kit/clock";
import { BEAT, BUMP, BUTTON_AT, LENGTH, LOGO } from "@/lib/trailer/towns/teaser";
import CarBump from "@/components/trailer/CarBump";

// The Towns teaser's end card: GIT CITY stamped on, TOWNS stamped on its
// corner, COMING SOON, and the orange car honking at the Y.

const ORANGE = "#e07a4f";

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
      stamp={{ text: "TOWNS", color: ORANGE }}
      line="COMING SOON"
      at={{ name: 1, stamp: 3, line: 5, button: BUTTON_AT, hit: BUTTON_AT + BUMP }}
      button={
        <CarBump clock={clock} beat={BEAT} from={LOGO + BUTTON_AT} bump={BUMP} color={ORANGE} stopX={73.5} />
      }
    />
  );
}
