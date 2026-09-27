"use client";

import { useMemo } from "react";
import CityScene from "@/components/CityScene";
import type { BuildingColors } from "@/components/city/theme";
import { generateCityLayout, type DeveloperRecord } from "@/lib/github";
import type { LayoutNorms } from "@/lib/city-layout-core";

// Git City on the horizon: the city's biggest developers laid out the way the
// main city lays them out (a real little downtown, roads and all), moved to
// `at` (city units) across the water from the spot.

export default function Skyline({
  devs,
  norms,
  at,
  colors,
}: {
  devs: Record<string, unknown>[];
  norms: LayoutNorms;
  /** Where the downtown's center goes (city units, ground level). */
  at: [number, number];
  colors: BuildingColors;
}) {
  const buildings = useMemo(() => {
    if (devs.length === 0) return [];
    const layout = generateCityLayout(devs as unknown as DeveloperRecord[], undefined, norms);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const b of layout.buildings) {
      minX = Math.min(minX, b.position[0]);
      maxX = Math.max(maxX, b.position[0]);
      minZ = Math.min(minZ, b.position[2]);
      maxZ = Math.max(maxZ, b.position[2]);
    }
    const dx = at[0] - (minX + maxX) / 2;
    const dz = at[1] - (minZ + maxZ) / 2;
    return layout.buildings.map((b) => ({ ...b, position: [b.position[0] + dx, b.position[1], b.position[2] + dz] as [number, number, number] }));
  }, [devs, norms, at]);
  if (buildings.length === 0) return null;
  return <CityScene buildings={buildings} colors={colors} accentColor={colors.accent} />;
}
