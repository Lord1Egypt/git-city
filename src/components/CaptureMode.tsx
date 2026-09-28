"use client";

import { useEffect } from "react";

// ?capture=1 hides everything but the 3D scene, ?capture=hud only the cursor
// (globals.css): clean footage for trailers.
export default function CaptureMode() {
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("capture");
    if (c) document.documentElement.dataset.capture = c;
  }, []);
  return null;
}
