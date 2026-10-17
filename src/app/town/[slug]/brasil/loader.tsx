"use client";

import dynamic from "next/dynamic";
import type { BrasilTownProps } from "./brasil-town";

// The Brasil town and its scene in one client bundle (one three.js), loaded in the browser only.
const BrasilTown = dynamic(() => import("./brasil-town"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-bg font-pixel text-[10px] uppercase text-muted">Building Brazil</div>
  ),
});

export default function BrasilTownLoader(props: BrasilTownProps) {
  return <BrasilTown {...props} />;
}
