"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

/** Shorter stints are a misclick or a reload, not time spent. */
const MIN_SECONDS = 5;

/**
 * Reports how long `active` stayed on with the tab visible, as one PostHog
 * event (`seconds` plus `props`) when it turns off, the component unmounts or
 * the page goes away. A hidden tab doesn't count.
 */
export function useActiveTime(event: string, props: Record<string, unknown>, active: boolean) {
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!active) return;
    let total = 0;
    let since: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let sent = false;
    const pause = () => {
      if (since === null) return;
      total += Date.now() - since;
      since = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") since ??= Date.now();
      else pause();
    };
    const send = () => {
      pause();
      const seconds = Math.round(total / 1000);
      if (sent || seconds < MIN_SECONDS) return;
      sent = true;
      posthog.capture(event, { ...propsRef.current, seconds }, { transport: "sendBeacon" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [active, event]);
}
