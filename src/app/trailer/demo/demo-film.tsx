"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Transport } from "@trailer-kit/clock";
import type { Frame } from "@trailer-kit/film";
import { BUMP, BUTTON_AT, CARD, FILM, LENGTH, LINE_AT, NAME_AT, STAMP_AT, type Stage } from "@/lib/trailer/demo/film";
import Studio from "@trailer-kit/Studio";
import EndCard from "@trailer-kit/examples/gitcity/EndCard";
import Titles from "@trailer-kit/examples/gitcity/Titles";
import CarBump from "@/components/trailer/CarBump";
import DemoWorld from "@/components/trailer/demo/DemoWorld";
import DemoRig from "@/components/trailer/demo/DemoRig";

// The demo film (lib/trailer/demo/film) in the studio. Each stage is its own
// canvas that stays mounted the whole film: a cut only changes which one
// shows, and a split shows the middle half of each side by side (a remount
// would drop its WebGL context). The shots are DemoRig's, the world
// DemoWorld's, the end card the kit's EndCard with the game's car as its
// button. Everything reads one clock.

const CAR: Record<Stage, string> = { day: "#ff8f45", night: "#8cc4ff" };

export default function DemoFilm() {
  const [clock] = useState(() => new Transport(FILM.beat));

  const stage = (s: Stage, frame: Frame<Stage>) => {
    const split = frame.kind === "split";
    const show = split || (frame.kind === "full" && frame.stage === s);
    return (
      <div
        className="absolute inset-y-0 overflow-hidden"
        style={
          split
            ? { left: s === "day" ? 0 : "50%", width: "50%" }
            : { left: 0, width: "100%", visibility: show ? "visible" : "hidden" }
        }
      >
        {/* Split: each half shows the middle of its stage's full-width picture. */}
        <div
          className="absolute inset-y-0"
          style={split ? { left: "-50%", width: "200%" } : { left: 0, width: "100%" }}
        >
          <Canvas dpr={2} camera={{ fov: 50, near: 0.5, far: 2000 }}>
            <DemoWorld stage={s} />
            <DemoRig stage={s} clock={clock} color={CAR[s]} />
          </Canvas>
        </div>
      </div>
    );
  };

  return (
    // Nothing in this world is destroyed, so there is nothing to put back on a reset.
    <Studio film={FILM} clock={clock} onReset={() => {}} title="Kit demo" titles={(cues) => <Titles cues={cues} />}>
      {(frame) => (
        <>
          {stage("day", frame)}
          {stage("night", frame)}
          {frame.kind === "black" && <div className="absolute inset-0 bg-black" />}
          <EndCard
            clock={clock}
            beat={FILM.beat}
            start={CARD}
            end={LENGTH}
            words={[
              ["GIT", "#e8dcc8"],
              ["CITY", "#c8e64a"],
            ]}
            stamp={{ text: "KIT", color: "#5b8def" }}
            line="MAKE YOUR OWN"
            at={{ name: NAME_AT, stamp: STAMP_AT, line: LINE_AT, button: BUTTON_AT, hit: BUTTON_AT + BUMP }}
            button={
              <CarBump
                clock={clock}
                beat={FILM.beat}
                from={CARD + BUTTON_AT}
                bump={BUMP}
                color={CAR.day}
                stopX={73.5}
              />
            }
          />
        </>
      )}
    </Studio>
  );
}
