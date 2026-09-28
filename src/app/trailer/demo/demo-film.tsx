"use client";

import { useEffect, useRef, useState } from "react";
import { beatOf, Transport, type FilmClock } from "@/lib/trailer/clock";
import {
  buildShots,
  frameOf,
  momentOf,
  scenesOf,
  shotFor,
  type Film,
  type Frame,
  type Take,
} from "@/lib/trailer/film";
import Studio from "@/components/trailer/Studio";

// The smallest film the trailer kit can play, and the template for your own
// (tools/trailer/README.md, "A film of your own"). No game, no data: two
// stages drawn in plain HTML, a block that slides and jumps. It shows every
// piece: takes on a beat grid, a split take, a trimmed and a frozen take, a
// moment with a title, a flash and a sound on it, and pictures that are pure
// functions of the take's time.

const BPM = 120;
const BEAT = 60 / BPM;

type Stage = "day" | "night";
type Kind = "slide" | "jump";

// [name, stage, kind, beats long, trim, freeze]
const TAKES: Take<Stage, Kind>[] = [
  ["Both slide", "both", "slide", 4, 0],
  ["Day jump", "day", "jump", 4, 0],
  ["Night slide · freeze", "night", "slide", 4, 1, 3],
];
const SHOTS = buildShots(TAKES, ["day", "night"]);

/** The jump lands on beat 2 of its take's action. */
const LANDS = 2;
const jump = SHOTS.find((s) => s.kind === "jump")!;

const FILM: Film<Stage> = {
  beat: BEAT,
  length: SHOTS[SHOTS.length - 1].end,
  scenes: scenesOf(SHOTS),
  // The game's own impact sound (CC0, in the repo), on the landing.
  sounds: [{ beat: momentOf(jump, LANDS), src: "/sounds/drive/impact.ogg", gain: 0.7 }],
  titles: [
    { start: momentOf(jump, 0.5), end: jump.end, text: "Jump", place: "tag", color: "#c8e64a" },
  ],
  flashes: [momentOf(jump, LANDS)],
  frameAt: (beat) => frameOf(SHOTS, beat),
};

const SKY: Record<Stage, string> = { day: "#7ec8e3", night: "#141a3a" };

/** One stage: its own box that never remounts; a cut only changes what's visible. */
function DemoStage({
  stage,
  clock,
  frame,
}: {
  stage: Stage;
  clock: FilmClock;
  frame: Frame<Stage>;
}) {
  const block = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { shot, t } = shotFor(SHOTS, stage, beatOf(clock), BEAT);
      const b = block.current;
      if (!b) return;
      // A pure function of t: scrubbing, looping and slow motion come for free.
      const x = shot.kind === "slide" ? 10 + (t / 2) * 70 : 45;
      const land = LANDS * BEAT;
      const y = shot.kind === "jump" && t < land ? 4 * 30 * (t / land) * (1 - t / land) : 0;
      b.style.left = `${Math.min(85, x)}%`;
      b.style.bottom = `${20 + y}%`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, clock]);

  const split = frame.kind === "split";
  const show = split || (frame.kind === "full" && frame.stage === stage);
  return (
    <div
      className="absolute inset-y-0 overflow-hidden"
      style={{
        left: split && stage === "night" ? "50%" : 0,
        width: split ? "50%" : "100%",
        visibility: show ? "visible" : "hidden",
        background: SKY[stage],
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-[20%]"
        style={{ background: stage === "day" ? "#5a8f3c" : "#2a3350" }}
      />
      <div
        ref={block}
        className="absolute size-[10%]"
        style={{ background: stage === "day" ? "#e07a4f" : "#5b8def" }}
      />
    </div>
  );
}

export default function DemoFilm() {
  const [clock] = useState(() => new Transport(BEAT));
  return (
    <Studio film={FILM} clock={clock} onReset={() => {}}>
      {(frame) => (
        <>
          <DemoStage stage="day" clock={clock} frame={frame} />
          <DemoStage stage="night" clock={clock} frame={frame} />
          {frame.kind === "black" && <div className="absolute inset-0 bg-black" />}
        </>
      )}
    </Studio>
  );
}
