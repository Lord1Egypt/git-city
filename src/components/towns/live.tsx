"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/components/league/hud/shared";
import { inTown, type TownLive } from "@/lib/towns/live";

// Who's inside each town now (lib/towns/live), on every /towns card: the same
// badge in the same spot, bottom left of the town's picture, clear of the
// "Your side" and logo corners on top.

const LIVE_MS = 15_000;

/** Every town with someone in it, polled while the tab is visible. */
export function useTownsLive(): Record<string, TownLive> {
  const [live, setLive] = useState<Record<string, TownLive>>({});
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = () =>
      fetch("/api/towns/live")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setLive(j))
        .catch(() => {});
    const start = () => {
      if (timer) return;
      void load();
      timer = setInterval(load, LIVE_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return live;
}

/** "● 12 in town / 3 driving", nothing when the town is empty. Sits inside the card's picture (relative). */
export function LiveBadge({ live }: { live: TownLive | null | undefined }) {
  if (!live || inTown(live) === 0) return null;
  return (
    <span className="absolute bottom-2 left-2 bg-bg px-2 py-1 text-[10px] leading-snug text-cream tabular-nums sm:text-xs">
      <span className="flex items-center gap-1.5">
        <span className="blink-dot inline-block h-1.5 w-1.5 shrink-0 bg-lime" aria-hidden />
        {fmt(inTown(live))} in town
      </span>
      {live.driving > 0 && <span className="block pl-3 text-muted">{fmt(live.driving)} driving</span>}
    </span>
  );
}
