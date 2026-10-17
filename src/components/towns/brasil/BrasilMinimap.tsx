"use client";

import { useMemo, useSyncExternalStore } from "react";
import { LOT } from "@/lib/league-city/grid";
import { mapNav, type MapCameraStore } from "@/lib/map-nav";
import { MAP_BOUNDS, OUTLINE } from "@/lib/towns/brasil-geo";
import type { CityLayout } from "@/lib/towns/brasil-map";
import { swatchOf } from "./stats";

// Brazil in a corner: the coast, a dot per city sized by its devs, where
// the camera is looking. A click flies there.

const W = 150;

export default function BrasilMinimap({ cities, island, camera }: { cities: CityLayout[]; island: CityLayout; camera: MapCameraStore }) {
  const cam = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  const pad = 600;
  const x0 = MAP_BOUNDS.minX - pad;
  const z0 = MAP_BOUNDS.minZ - pad;
  const span = Math.max(MAP_BOUNDS.maxX - MAP_BOUNDS.minX, MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) + pad * 2;
  const k = W / span;
  const path = useMemo(() => OUTLINE.map((r) => `M${r.map(([x, z]) => `${((x - x0) * k).toFixed(1)},${((z - z0) * k).toFixed(1)}`).join("L")}Z`).join(""), [x0, z0, k]);
  const dot = (c: CityLayout) => {
    const [x, z] = c.hub;
    return { cx: (x * LOT - x0) * k, cy: (z * LOT - z0) * k, r: Math.min(5, 1.2 + Math.sqrt(c.devs.length) * 0.35) };
  };
  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * W;
    mapNav.send({ type: "flyTo", x: x / k + x0, z: y / k + z0, distance: 2600 });
  };
  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-30 border-[3px] border-border bg-bg/80 p-1 backdrop-blur-sm max-sm:hidden">
      <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} onClick={click} className="cursor-pointer" role="img" aria-label="Map of Brazil">
        <path d={path} fill="#1d2634" stroke="#4b5466" strokeWidth={1} />
        {[...cities, island].map((c) => {
          const d = dot(c);
          return <circle key={`${c.uf ?? "isl"}-${c.second ? 2 : 1}`} cx={d.cx} cy={d.cy} r={d.r} fill={c.uf ? swatchOf(c.uf) : "#c8e64a"} stroke="#0b0d12" strokeWidth={0.8} opacity={c.devs.length ? 1 : 0.35} />;
        })}
        <circle cx={(cam.tx - x0) * k} cy={(cam.tz - z0) * k} r={4} fill="none" stroke="#c8e64a" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
