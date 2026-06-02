"use client";

import type { ReactNode } from "react";
import {
  NeonOutline,
  ParticleAura,
  SpotlightEffect,
  RooftopFire,
  Helipad,
  AntennaArray,
  RooftopGarden,
  Spire,
  Billboards,
  Flag,
  NeonTrim,
  SatelliteDish,
  CrownItem,
  CompanionDuck,
  PoolParty,
  HologramRing,
  LightningAura,
  LEDBanner,
  GitHubStar,
} from "@/components/BuildingEffects";
import { MiniWhiteRabbit } from "@/components/WhiteRabbit";
import {
  ZONE_ITEMS,
  FACES_ITEMS,
  RAID_VEHICLE_ITEMS,
  RAID_TAG_ITEMS,
} from "@/lib/zones";

// ─── Single source of truth: item_id → 3D visual ──────────────
//
// Every place that draws an item on a building (the live city in
// Building3D, the shop's ShopPreview, the admin cosmetics gallery) renders
// through THIS function. One dispatch, so coverage never drifts: if an item
// renders here it renders everywhere, and a missing case is missing
// everywhere (visible immediately in the gallery).

export interface BuildingVisualOpts {
  width: number;
  height: number;
  depth: number;
  color?: string;
  focused?: boolean;
  billboardImages?: string[];
}

/** All item_ids that draw something on/around a building (not vehicles/tags/utility). */
export const BUILDING_ITEM_IDS: ReadonlySet<string> = new Set<string>([
  ...ZONE_ITEMS.crown,
  ...ZONE_ITEMS.roof,
  ...ZONE_ITEMS.aura,
  ...FACES_ITEMS,
  "white_rabbit",
]);

export function buildingItemVisual(itemId: string, o: BuildingVisualOpts): ReactNode {
  const { width, height, depth, color, focused, billboardImages } = o;
  switch (itemId) {
    // Aura
    case "neon_outline": return <NeonOutline width={width} height={height} depth={depth} color={color} />;
    case "particle_aura": return <ParticleAura width={width} height={height} depth={depth} color={color} />;
    case "spotlight": return <SpotlightEffect height={height} width={width} depth={depth} color={color} />;
    case "neon_trim": return <NeonTrim width={width} height={height} depth={depth} color={color} />;
    case "hologram_ring": return <HologramRing width={width} height={height} depth={depth} color={color} />;
    case "lightning_aura": return <LightningAura width={width} height={height} depth={depth} color={color} />;
    // Roof
    case "rooftop_fire": return <RooftopFire height={height} width={width} depth={depth} />;
    case "antenna_array": return <AntennaArray height={height} width={width} depth={depth} />;
    case "rooftop_garden": return <RooftopGarden height={height} width={width} depth={depth} />;
    case "pool_party": return <PoolParty height={height} width={width} depth={depth} />;
    // Crown
    case "helipad": return <Helipad height={height} width={width} depth={depth} />;
    case "spire": return <Spire height={height} width={width} depth={depth} />;
    case "flag": return <Flag height={height} width={width} depth={depth} color={color} />;
    case "satellite_dish": return <SatelliteDish height={height} width={width} depth={depth} color={color} />;
    case "crown_item": return <CrownItem height={height} color={color} focused={focused} />;
    case "github_star": return <GitHubStar height={height} width={width} depth={depth} color={color} />;
    case "companion_duck": return <CompanionDuck height={height} width={width} depth={depth} variant="companion_duck" />;
    case "duck_combatant": return <CompanionDuck height={height} width={width} depth={depth} variant="duck_combatant" />;
    case "duck_gold_animated": return <CompanionDuck height={height} width={width} depth={depth} variant="duck_gold_animated" />;
    // Faces
    case "billboard": return <Billboards height={height} width={width} depth={depth} images={billboardImages ?? []} color={color} />;
    case "led_banner": return <LEDBanner height={height} width={width} depth={depth} color={color} />;
    // custom_color tints the building face itself (no overlay mesh)
    case "custom_color": return null;
    // Easter egg
    case "white_rabbit": return <MiniWhiteRabbit height={height} width={width} depth={depth} />;
    default: return null;
  }
}

// ─── Preview classification (which scene to compose) ──────────

export type PreviewKind = "building" | "vehicle" | "tag" | "utility";

// Building dims used for every on-building preview / thumbnail.
export const PREVIEW_BD = { width: 18, height: 40, depth: 18 };

// Camera framing per preview kind (shared by the live preview and the
// thumbnail factory so cards match the big preview).
export const PREVIEW_VIEWS: Record<PreviewKind, { cam: [number, number, number]; target: [number, number, number]; fov: number; min: number; max: number }> = {
  building: { cam: [62, 52, 82], target: [0, 32, 0], fov: 42, min: 40, max: 200 },
  tag: { cam: [62, 52, 82], target: [0, 32, 0], fov: 42, min: 40, max: 200 },
  vehicle: { cam: [0, 3, 13], target: [0, 1, 0], fov: 38, min: 6, max: 70 },
  utility: { cam: [0, 3.5, 13], target: [0, 2, 0], fov: 40, min: 6, max: 80 },
};

export function classifyItem(item: { id: string; zone?: string | null }): PreviewKind {
  if (RAID_VEHICLE_ITEMS.includes(item.id)) return "vehicle";
  if (RAID_TAG_ITEMS.includes(item.id)) return "tag";
  if (BUILDING_ITEM_IDS.has(item.id)) return "building";
  if (item.zone === "crown" || item.zone === "roof" || item.zone === "aura" || item.zone === "faces") return "building";
  // Boosters, consumables, anything with no in-world model.
  return "utility";
}
