"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DriveTelemetry } from "@/lib/league-city/drive/telemetry";
import { HUD_BOX } from "../shared";

// Rivalry smash, above the honk prompt: "pick a side" for a while after you
// run into a rival building without one, and the floor count while you're
// parked against your own broken building (the drive room builds it back).
// Read from the telemetry every animation frame, like the honk prompt.

const HINT_MS = 4500;

export default function SmashNotice({ telemetry }: { telemetry: DriveTelemetry }) {
  const hint = useRef<HTMLDivElement>(null);
  const rebuild = useRef<HTMLDivElement>(null);
  const floors = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      if (hint.current) hint.current.dataset.on = String(telemetry.sideHintAt > 0 && now - telemetry.sideHintAt < HINT_MS);
      if (rebuild.current && floors.current) {
        const on = telemetry.rebuildOf > 0;
        rebuild.current.dataset.on = String(on);
        if (on) floors.current.textContent = `${telemetry.rebuildFloors}/${telemetry.rebuildOf}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [telemetry]);

  // The box without its pointer-events-auto: the chips only take the pointer while they show.
  const chip = `${HUD_BOX.replace("pointer-events-auto", "")} absolute bottom-32 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap px-3 py-1.5 text-[10px] text-cream opacity-0 transition-opacity data-[on=true]:opacity-100`;
  return (
    <>
      <div ref={hint} data-on="false" className={`${chip} pointer-events-none data-[on=true]:pointer-events-auto`}>
        Pick a side to break their town
        <Link href="/towns" className="border-2 border-lime px-1.5 text-lime hover:bg-lime/10">
          Pick
        </Link>
      </div>
      <div ref={rebuild} data-on="false" className={`${chip} pointer-events-none`}>
        <span className="h-1.5 w-1.5 animate-pulse bg-lime" aria-hidden />
        Rebuilding <span ref={floors} className="text-lime" /> floors
      </div>
    </>
  );
}
