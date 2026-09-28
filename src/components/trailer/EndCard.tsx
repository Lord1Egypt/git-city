"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import CarModel from "@/components/league/drive/CarModel";
import { M_TO_UNIT, WHEEL } from "@/lib/league-city/drive/tuning";
import { WHEELS } from "@/lib/league-city/drive/vehicle";
import { beatOf, type FilmClock } from "@/lib/trailer/clock";

// A film's end card, as film end cards go: a hard cut to black, then a
// centred lockup with nothing around it. Driven by the film's clock in beats
// after the cut, so a scrub shows what records. With the default beats:
//   0  black, only the echo of the last hit
//   1  the name stamps in, big and centred: stepped, no easing, a flash
//   3  the stamp slams onto its corner like a rubber stamp (a sequel's "2")
//   5  the line types on, small and spaced, right under it
//   8  the button: the game's car rolls in along the baseline and into the
//      last letter, which wobbles and stays up (like a friend's building);
//      the car honks. The card holds to the film's end.
// The car's canvas stays mounted the whole film (hidden until the card), so
// no WebGL context is made and dropped on every loop. The sounds are the
// film's (SoundCue), put on the same beats.

const CREAM = "#e8dcc8";

/** Beats into the card. */
export interface CardBeats {
  name: number;
  stamp: number;
  line: number;
  button: number;
  /** The car reaches the last letter this long after the button starts. */
  bump: number;
}

export const CARD_BEATS: CardBeats = { name: 1, stamp: 3, line: 5, button: 8, bump: 0.8 };

export interface EndCardProps {
  clock: FilmClock;
  /** Seconds per beat. */
  beat: number;
  /** The card's first beat on the timeline (the cut to black), and its last. */
  start: number;
  end: number;
  /** The name, a word at a time: [text, color]. */
  words: [string, string][];
  /** The small word stamped on the name's corner after it lands. */
  stamp: { text: string; color: string };
  /** The line under the name. */
  line: string;
  /** The button's car: its color, and where its nose stops (% of the card's width, against the last letter). */
  car?: { color: string; stopX: number };
  at?: CardBeats;
}

/** The name's letters land this many beats apart. */
const LETTER_EVERY = 0.07;
/** Where the stamp's dust flies: [right, down] per bit. */
const DUST: [number, number][] = [
  [1, -0.6],
  [0.6, -1],
  [-0.2, -1],
  [1, 0.4],
  [0.4, 1],
  [-0.4, 0.9],
];

/** Stage units: the card is 100 wide and 56.25 tall, y down from the top. */
const W = 100;
const H = 56.25;
/** The car's wheels roll on the name's baseline (% of the height). */
const BASE_Y = 53;
const CAR_LEN = 10;
/** The model is ~11 city units long; this makes it CAR_LEN stage units. */
const CAR_SCALE = CAR_LEN / 11;
const _q = new THREE.Quaternion();
const _s = new THREE.Quaternion();
const _x = new THREE.Vector3(1, 0, 0);
const _y = new THREE.Vector3(0, 1, 0);

/**
 * The game's own car, side on, rolling in from the right along the name's
 * baseline and into its last letter. Like a friend's building in the game,
 * the letter doesn't break: the car bounces off it, rocks, and honks.
 */
function CarBump({
  beat,
  secondsPerBeat,
  color,
  stopX,
  at,
}: {
  beat: () => number;
  secondsPerBeat: number;
  color: string;
  stopX: number;
  at: CardBeats;
}) {
  const car = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Object3D | null)[]>([]);
  const spin = useRef(0);
  useFrame((three, dt) => {
    // The orthographic camera counts in pixels: zoom it so the card is W units wide.
    const cam = three.camera as THREE.OrthographicCamera;
    const zoom = three.size.width / W;
    if (cam.zoom !== zoom) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
    const g = car.current;
    if (!g) return;
    const u = beat() - at.button;
    g.visible = u >= 0;
    if (u < 0) return;
    const t = u * secondsPerBeat;
    const tHit = at.bump * secondsPerBeat;
    // In at speed, braking into the letter; a bounce back off it, then still.
    const x0 = 118;
    const stop = stopX + CAR_LEN / 2;
    let x: number;
    let speed: number;
    if (t < tHit) {
      const k = t / tHit;
      x = x0 - (x0 - stop) * (1 - (1 - k) ** 1.6);
      speed = (1.6 * (x0 - stop) * (1 - k) ** 0.6) / tHit;
    } else {
      const k = t - tHit;
      x = stop + 1.8 * Math.sin(Math.min(k / 0.18, 1) * Math.PI * 0.5) * Math.exp(-k * 4);
      speed = 0;
    }
    // The body: nose dips on the hit, then a little hop on each honk.
    const since = t - tHit;
    const pitch = since > 0 ? -0.12 * Math.exp(-since * 7) * Math.cos(since * 30) : 0;
    const honk =
      since > 0.16 && since < 0.4 ? Math.abs(Math.sin((since - 0.16) * Math.PI * 8)) * 0.35 : 0;
    g.position.set(x - W / 2, -(BASE_Y / 100) * H + H / 2 + honk, 0);
    g.rotation.set(0, -Math.PI / 2 + 0.28, pitch);
    spin.current += (speed * dt) / (WHEEL.radius * M_TO_UNIT * CAR_SCALE);
    WHEELS.forEach((w, i) => {
      const o = wheels.current[i];
      if (!o) return;
      o.position.set(
        w.x * M_TO_UNIT,
        (WHEEL.connectionY - WHEEL.restLength) * M_TO_UNIT,
        w.z * M_TO_UNIT,
      );
      _q.setFromAxisAngle(_y, w.x < 0 ? Math.PI : 0);
      _s.setFromAxisAngle(_x, spin.current * (w.x < 0 ? -1 : 1));
      o.quaternion.copy(_q).multiply(_s);
    });
  });
  return (
    <group ref={car} scale={CAR_SCALE} visible={false}>
      <Suspense fallback={null}>
        <CarModel color={color} wheelRefs={wheels} />
      </Suspense>
    </group>
  );
}

export default function EndCard({
  clock,
  beat: secondsPerBeat,
  start,
  end,
  words,
  stamp,
  line,
  car,
  at = CARD_BEATS,
}: EndCardProps) {
  // Beats since the cut to black.
  const beat = useCallback(() => beatOf(clock) - start, [clock, start]);
  const length = end - start;
  const [b, setB] = useState(() => beat());
  useEffect(() => {
    let raf = 0;
    let was = NaN;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = beat();
      // Only re-render while the card is on (or just leaving it).
      if (now >= 0 && now < length) setB(now);
      else if (was >= 0 && was < length) setB(now);
      was = now;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [beat, length]);
  const active = b >= 0 && b < length;

  const shown = active && b >= at.name;
  const flash = shown && b - at.name < 0.05;
  // The stamp lands like a rubber stamp: big and faint for a frame, then down hard.
  const stampIn = b - at.stamp;
  const stampScale = stampIn < 0.06 ? 1.9 : 1;
  const stampJolt = stampIn >= 0 && stampIn < 0.12 ? 0.12 : 0;
  // The button: the last letter takes the hit and wobbles back upright (it doesn't break).
  const since = (b - at.button - at.bump) * secondsPerBeat;
  const wobble = car && since > 0 ? -6 * Math.exp(-since * 6) * Math.cos(since * 28) : 0;
  const jolt = (car && since > 0 && since < 0.06 ? 0.12 : 0) + stampJolt;
  const letters = words.reduce((n, [w]) => n + w.length, 0);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-black"
      style={{ visibility: active ? "visible" : "hidden" }}
    >
      {shown && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform: `translate(${jolt}cqw, ${jolt}cqw)` }}
        >
          <div className="relative flex items-end gap-[3.2cqw] text-[10.5cqw] leading-none">
            {/* The name stamps in letter by letter, stepped: each one a frame big, then set. */}
            {words.map(([word, color], wi) => {
              const first = words.slice(0, wi).reduce((n, [w]) => n + w.length, 0);
              return (
                <p key={wi} className="flex" style={{ color }}>
                  {[...word].map((ch, j) => {
                    const k = first + j;
                    const at0 = at.name + k * LETTER_EVERY;
                    if (b < at0)
                      return (
                        <span key={j} className="inline-block opacity-0">
                          {ch}
                        </span>
                      );
                    const big = b - at0 < 0.07;
                    const hit = k === letters - 1 && wobble !== 0;
                    return (
                      <span
                        key={j}
                        className="inline-block"
                        style={{
                          transform: `${big ? "scale(1.25)" : ""} ${hit ? `rotate(${wobble}deg)` : ""}`,
                          transformOrigin: hit ? "left bottom" : "center",
                        }}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </p>
              );
            })}
            {stampIn >= 0 && (
              <div
                className="absolute -right-[5.5cqw] -top-[2.6cqw] border-[0.35cqw] px-[1cqw] py-[0.45cqw] text-[2.8cqw] leading-none"
                style={{
                  color: stamp.color,
                  borderColor: stamp.color,
                  background: "#000",
                  transform: `rotate(8deg) scale(${stampScale})`,
                  opacity: stampIn < 0.06 ? 0.35 : 1,
                }}
              >
                {stamp.text}
              </div>
            )}
            {/* Dust off the stamp. */}
            {stampIn > 0.06 &&
              stampIn < 0.7 &&
              DUST.map(([dx, dy], i) => (
                <span
                  key={i}
                  className="absolute size-[0.6cqw]"
                  style={{
                    right: `${-1 - dx * stampIn * 6}cqw`,
                    top: `${-0.5 + dy * stampIn * 5}cqw`,
                    background: stamp.color,
                    opacity: 1 - stampIn / 0.7,
                  }}
                />
              ))}
          </div>
          {/* The line types on, one letter a step; the padding balances the tracking. */}
          <p
            className="mt-[3cqw] pl-[0.5em] text-[1.6cqw] leading-none tracking-[0.5em]"
            style={{ color: CREAM }}
          >
            {[...line].map((ch, i) => (
              <span key={i} style={{ opacity: b >= at.line + i * 0.06 ? 0.85 : 0 }}>
                {ch}
              </span>
            ))}
          </p>
        </div>
      )}
      {car && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ visibility: shown ? "visible" : "hidden" }}
        >
          <Canvas
            orthographic
            camera={{ near: -200, far: 200, position: [0, 6, 50] }}
            gl={{ alpha: true }}
            dpr={2}
          >
            <ambientLight intensity={1.4} />
            <directionalLight position={[20, 30, 40]} intensity={1.6} />
            <CarBump
              beat={beat}
              secondsPerBeat={secondsPerBeat}
              color={car.color}
              stopX={car.stopX}
              at={at}
            />
          </Canvas>
        </div>
      )}
      {flash && <div className="absolute inset-0 bg-white" />}
    </div>
  );
}
