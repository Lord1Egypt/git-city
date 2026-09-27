"use client";

import { useEffect, useRef, useState } from "react";
import { Bomb, ChevronsDown, Megaphone, Rocket, Zap, type LucideIcon } from "lucide-react";
import type { DriveTelemetry } from "@/lib/league-city/drive/telemetry";
import { ITEM_NAMES, isItem, type BattleItem } from "@/lib/league-city/drive/battle";
import { BOOST } from "@/lib/league-city/drive/tuning";
import { autoDrift, dragSteer, type TouchDrive } from "@/lib/league-city/drive/touch";

// Phone controls (lib drive/touch), laid out for a phone held upright and
// reachable with thumbs at the bottom corners:
//   anywhere   touch starts the car; drag left and right to steer (a ring
//              marks where the finger went down, a dot how far it went)
//   bottom     BRAKE (hold; reverses once stopped) left, BOOST (hold) right,
//              the speed between them
//   above it   the attack you hold, and HONK when you're parked at a
//              teammate's building, only while they apply
// Everything under the other HUD pieces, so their buttons still take taps.

const ITEM_ICON: Record<BattleItem, LucideIcon> = { shock: Zap, bomb: Bomb, missile: Rocket };
const BLOCKS = 10;
/** A tap on the attack or the horn holds its input this long, so the car sees it (ms). */
const TAP_MS = 150;

const PAD =
  "pointer-events-auto flex touch-none select-none flex-col items-center justify-center gap-1 border-[3px] bg-bg/75 backdrop-blur-sm [-webkit-touch-callout:none] transition-colors";

export default function TouchControls({ touchRef, telemetry }: { touchRef: React.MutableRefObject<TouchDrive>; telemetry: DriveTelemetry }) {
  const drag = useRef<{ id: number; origin: number; x: number; y: number } | null>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [brake, setBrake] = useState(false);
  const [boost, setBoost] = useState(false);
  const [item, setItem] = useState<BattleItem | null>(null);
  const [near, setNear] = useState<string | null>(null);

  // On while mounted; a clean slate either way.
  useEffect(() => {
    const t = touchRef.current;
    Object.assign(t, { on: true, started: false, steer: 0, brake: false, boost: false, drift: false, fire: false, horn: false });
    return () => {
      Object.assign(t, { on: false, started: false, steer: 0, brake: false, boost: false, drift: false, fire: false, horn: false });
    };
  }, [touchRef]);

  // Every frame: auto drift, the speed readout, and what the buttons offer.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let held = 0;
    let shownItem: BattleItem | null = null;
    let shownNear: string | null = null;
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
  const hold = (key: "brake" | "boost", set: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      touchRef.current[key] = true;
      // Braking or boosting counts as a first touch too.
      touchRef.current.started = true;
      set(true);
    },
    onPointerUp: () => {
      touchRef.current[key] = false;
      set(false);
    },
    onPointerCancel: () => {
      touchRef.current[key] = false;
      set(false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* What applies right now */}
        <div className="flex items-end gap-3">
          {near && (
            <button
              type="button"
              onClick={tap("horn")}
              className={`${PAD} h-12 flex-row gap-2 border-lime px-3 text-[10px] text-lime active:bg-lime active:text-bg`}
            >
              <Megaphone size={16} strokeWidth={2.5} aria-hidden />
              <span className="max-w-[9rem] truncate">Honk @{near}</span>
            </button>
          )}
          {item && Icon && (
            <button
              type="button"
              onClick={tap("fire")}
              aria-label={`Throw the ${ITEM_NAMES[item].toLowerCase()}`}
              className={`${PAD} h-16 w-16 border-[#ff5ad8] bg-[#ff5ad8]/20 text-[9px] text-[#ff9be8] active:bg-[#ff5ad8] active:text-bg`}
            >
              <Icon size={24} strokeWidth={2.5} aria-hidden />
              {ITEM_NAMES[item]}
            </button>
          )}
        </div>

        <div className="flex w-full max-w-md items-end justify-between gap-3">
          <button
            type="button"
            aria-label="Brake, hold to reverse"
            {...hold("brake", setBrake)}
            className={`${PAD} h-[4.5rem] w-[4.5rem] text-[10px] ${brake ? "border-cream bg-cream text-bg" : "border-border text-cream"}`}
          >
            <ChevronsDown size={22} strokeWidth={2.5} aria-hidden />
            Brake
          </button>

          <div className="mb-1 flex flex-col items-center gap-1.5 bg-bg/60 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-baseline gap-1 tabular-nums">
              <span ref={speed} className="text-xl leading-none text-cream">
                0
              </span>
              <span className="text-[8px] text-muted">km/h</span>
            </div>
            <div ref={bar} data-boost="false" className="group flex gap-[3px]" aria-hidden>
              {Array.from({ length: BLOCKS }, (_, i) => (
                <span
                  key={i}
                  data-on="false"
                  className="h-1.5 w-1.5 bg-border data-[on=true]:bg-lime group-data-[boost=true]:data-[on=true]:bg-[#7ee8ff]"
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-label="Boost, hold"
            {...hold("boost", setBoost)}
            className={`${PAD} h-[4.5rem] w-[4.5rem] text-[10px] ${
              boost ? "border-[#7ee8ff] bg-[#7ee8ff] text-bg" : "border-[#7ee8ff] text-[#7ee8ff]"
            }`}
          >
            <Zap size={22} strokeWidth={2.5} aria-hidden />
            Boost
          </button>
        </div>
      </div>
    </>
  );
}
