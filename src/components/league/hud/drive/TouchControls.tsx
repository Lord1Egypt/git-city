"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBigDown, Bomb, ChevronsDown, Megaphone, Rocket, Wind, Zap, type LucideIcon } from "lucide-react";
import type { DriveTelemetry } from "@/lib/league-city/drive/telemetry";
import { ITEM_NAMES, isItem, type BattleItem } from "@/lib/league-city/drive/battle";
import { BOOST } from "@/lib/league-city/drive/tuning";
import { autoDrift, dragSteer, type TouchDrive } from "@/lib/league-city/drive/touch";

// Phone controls (lib drive/touch), laid out for a phone held upright, on one
// grid so everything lines up:
//   anywhere   touch starts the car; drag left and right to steer (a ring
//              marks where the finger went down, a dot how far it went);
//              steering hard at speed drifts by itself
//   primary    big, in the bottom corners: BRAKE (hold), which says REVERSE
//              once the car has stopped since that's what it does then, and
//              BOOST (hold); the speed between them
//   secondary  smaller, centered over them: DRIFT (hold while steering) and
//              HORN, which lights up with the teammate's name when you're
//              parked at their building (honking opens it)
//   attack     between the two, only while you hold one
// The button a prompt is teaching pulses (`lesson`). Everything sits under the
// other HUD pieces, so their buttons still take taps.

const ITEM_ICON: Record<BattleItem, LucideIcon> = { shock: Zap, bomb: Bomb, missile: Rocket };
/** Attacks: the ? boxes' orange. */
export const ATTACK = "#ff9a3c";
const BLOCKS = 10;
/** A tap on the attack or the horn holds its input this long, so the car sees it (ms). */
const TAP_MS = 150;
/** Under this (m/s, forward) the brake button reverses. */
const REVERSE_BELOW = 0.5;

const BASE =
  "pointer-events-auto relative flex touch-none select-none items-center justify-center border-[3px] bg-bg/80 backdrop-blur-sm [-webkit-touch-callout:none] transition-colors";
/** Two sizes, for two ranks: brake and boost you hold all the time, drift and horn now and then. */
const BIG = `${BASE} h-20 w-20 flex-col gap-1 text-[10px]`;
const SMALL = `${BASE} h-14 w-14 flex-col gap-0.5 text-[8px]`;
/** The attack: as tall as the small buttons, icon and name on one line. */
const CHIP = `${BASE} h-14 gap-2 px-3 text-[10px] whitespace-nowrap`;
/** The button a prompt teaches: a ring pulses around it, the button stays as it is. */
function Pulse({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="pointer-events-none absolute -inset-[7px] animate-ping border-[3px] border-lime" aria-hidden />;
}

export type TouchLesson = "boost" | "drift" | "attack" | null;

export default function TouchControls({
  touchRef,
  telemetry,
  lesson = null,
}: {
  touchRef: React.MutableRefObject<TouchDrive>;
  telemetry: DriveTelemetry;
  /** The button a prompt is teaching right now. */
  lesson?: TouchLesson;
}) {
  const drag = useRef<{ id: number; origin: number; x: number; y: number } | null>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [brake, setBrake] = useState(false);
  const [drift, setDrift] = useState(false);
  const [boost, setBoost] = useState(false);
  const [reverse, setReverse] = useState(true);
  const [item, setItem] = useState<BattleItem | null>(null);
  const [near, setNear] = useState<string | null>(null);

  // On while mounted; a clean slate either way.
  useEffect(() => {
    const t = touchRef.current;
    const idle = { started: false, steer: 0, brake: false, boost: false, drift: false, driftButton: false, fire: false, horn: false };
    Object.assign(t, idle, { on: true });
    return () => {
      Object.assign(t, idle, { on: false });
    };
  }, [touchRef]);

  // Every frame: auto drift, the speed readout, and what the buttons offer.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let held = 0;
    let shownItem: BattleItem | null = null;
    let shownNear: string | null = null;
    let shownReverse = true;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = touchRef.current;
      const d = autoDrift(t.drift, held, drag.current ? t.steer : 0, telemetry.speed, dt);
      t.drift = d.drift;
      held = d.held;
      if (speed.current) speed.current.textContent = String(Math.round(Math.abs(telemetry.speed) * 3.6));
      if (bar.current) {
        const lit = Math.round(Math.min(1, Math.abs(telemetry.speed) / BOOST.topSpeed) * BLOCKS);
        bar.current.dataset.boost = String(telemetry.boosting);
        const blocks = bar.current.children;
        for (let i = 0; i < blocks.length; i++) (blocks[i] as HTMLElement).dataset.on = String(i < lit);
      }
      const rev = telemetry.speed < REVERSE_BELOW;
      if (rev !== shownReverse) {
        shownReverse = rev;
        setReverse(rev);
      }
      const it = isItem(telemetry.held) ? telemetry.held : null;
      if (it !== shownItem) {
        shownItem = it;
        setItem(it);
      }
      if (telemetry.near !== shownNear) {
        shownNear = telemetry.near;
        setNear(shownNear);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touchRef, telemetry]);

  const showDrag = () => {
    const d = drag.current;
    if (!ring.current || !dot.current) return;
    ring.current.style.opacity = d ? "1" : "0";
    dot.current.style.opacity = d ? "1" : "0";
    if (!d) return;
    ring.current.style.transform = `translate(${d.origin}px, ${d.y}px)`;
    dot.current.style.transform = `translate(${d.x}px, ${d.y}px)`;
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, origin: e.clientX, x: e.clientX, y: e.clientY };
    touchRef.current.started = true;
    showDrag();
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const s = dragSteer(d.origin, e.clientX, window.innerWidth);
    d.origin = s.origin;
    d.x = e.clientX;
    touchRef.current.steer = s.steer;
    showDrag();
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    touchRef.current.steer = 0;
    touchRef.current.drift = false;
    showDrag();
  };

  /** Hold-to-use buttons: on while the finger is on them. */
  const hold = (key: "brake" | "boost" | "driftButton", set: (v: boolean) => void) => {
    const off = () => {
      touchRef.current[key] = false;
      set(false);
    };
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        touchRef.current[key] = true;
        // Any button counts as a first touch too.
        touchRef.current.started = true;
        set(true);
      },
      onPointerUp: off,
      onPointerCancel: off,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  };
  const tap = (key: "fire" | "horn") => () => {
    touchRef.current[key] = true;
    window.setTimeout(() => (touchRef.current[key] = false), TAP_MS);
  };

  const Icon = item ? ITEM_ICON[item] : null;

  return (
    <>
      {/* Steering: the whole screen, under everything else. */}
      <div
        className="pointer-events-auto absolute inset-0 touch-none select-none [-webkit-touch-callout:none]"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden
      />
      <div
        ref={ring}
        className="pointer-events-none absolute left-0 top-0 -ml-7 -mt-7 h-14 w-14 rounded-full border-[3px] border-cream/40 opacity-0 transition-opacity"
        aria-hidden
      />
      <div
        ref={dot}
        className="pointer-events-none absolute left-0 top-0 -ml-4 -mt-4 h-8 w-8 rounded-full bg-cream/60 opacity-0 transition-opacity"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-md grid-cols-[5rem_minmax(0,1fr)_5rem] items-center gap-x-3 gap-y-3">
          {/* Row 1, secondary: Drift over Brake, Horn over Boost; the attack between them. */}
          <button
            type="button"
            aria-label="Drift, hold while steering"
            {...hold("driftButton", setDrift)}
            className={`${SMALL} justify-self-center ${drift ? "border-lime bg-lime text-bg" : "border-lime/80 text-lime"}`}
          >
            <Pulse on={lesson === "drift"} />
            <Wind size={18} strokeWidth={2.5} aria-hidden />
            Drift
          </button>
          <div className="flex min-w-0 justify-center">
            {item && Icon && (
              <button
                type="button"
                onClick={tap("fire")}
                aria-label={`Throw the ${ITEM_NAMES[item].toLowerCase()}`}
                className={`${CHIP} text-cream active:bg-[#ff9a3c] active:text-bg`}
                style={{ borderColor: ATTACK }}
              >
                <Pulse on={lesson === "attack"} />
                <Icon size={18} strokeWidth={2.5} color={ATTACK} className="shrink-0" aria-hidden />
                {ITEM_NAMES[item]}
              </button>
            )}
          </div>
          <div className="relative justify-self-center">
            {/* Parked at a teammate's building: whose, over the horn that opens it. */}
            {near && (
              <span className="pointer-events-none absolute bottom-full right-0 mb-2 max-w-[9rem] truncate border-2 border-lime bg-bg px-1.5 py-0.5 text-[9px] text-lime">
                @{near}
              </span>
            )}
            <button
              type="button"
              onClick={tap("horn")}
              aria-label={near ? `Honk at @${near}` : "Horn"}
              className={`${SMALL} ${near ? "border-lime text-lime" : "border-cream/40 text-cream/80"} active:bg-cream active:text-bg`}
            >
              <Megaphone size={18} strokeWidth={2.5} aria-hidden />
              Horn
            </button>
          </div>

          {/* Row 2, primary: Brake, the speed, Boost. */}
          <button
            type="button"
            aria-label={reverse ? "Reverse, hold" : "Brake, hold"}
            {...hold("brake", setBrake)}
            className={`${BIG} ${brake ? "border-cream bg-cream text-bg" : "border-cream/70 text-cream"}`}
          >
            {reverse ? <ArrowBigDown size={24} strokeWidth={2.5} aria-hidden /> : <ChevronsDown size={24} strokeWidth={2.5} aria-hidden />}
            {reverse ? "Reverse" : "Brake"}
          </button>
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-baseline gap-1 tabular-nums [text-shadow:2px_2px_0_rgba(0,0,0,0.6)]">
              <span ref={speed} className="text-2xl leading-none text-cream">
                0
              </span>
              <span className="text-[9px] text-cream/70">km/h</span>
            </div>
            <div ref={bar} data-boost="false" className="group flex gap-[3px]" aria-hidden>
              {Array.from({ length: BLOCKS }, (_, i) => (
                <span
                  key={i}
                  data-on="false"
                  className="h-1.5 w-2 bg-bg/70 data-[on=true]:bg-lime group-data-[boost=true]:data-[on=true]:bg-[#7ee8ff]"
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            aria-label="Boost, hold"
            {...hold("boost", setBoost)}
            className={`${BIG} ${boost ? "border-[#7ee8ff] bg-[#7ee8ff] text-bg" : "border-[#7ee8ff] text-[#7ee8ff]"}`}
          >
            <Pulse on={lesson === "boost"} />
            <Zap size={24} strokeWidth={2.5} aria-hidden />
            Boost
          </button>
        </div>
      </div>
    </>
  );
}
