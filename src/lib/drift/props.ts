// ─── Drift props ────────────────────────────────────────────
// The Kenney models (CC0) a drift spot can place: the Racing Kit, the Nature
// Kit and the City Kit Industrial, under public/models/drift. Each is fitted
// to a size in meters along one axis, since every kit has its own scale.

const BASE = "/models/drift";

/** Every model a spot can place, and how big it is in meters (along `axis`). */
export const MODELS = {
  grandstand: { url: `${BASE}/racing/grandStandCovered.glb`, size: 12, axis: "x" },
  grandstandRound: { url: `${BASE}/racing/grandStandCoveredRound.glb`, size: 19, axis: "x" },
  stand: { url: `${BASE}/racing/grandStand.glb`, size: 12, axis: "x" },
  garage: { url: `${BASE}/racing/pitsGarage.glb`, size: 10, axis: "x" },
  garageCorner: { url: `${BASE}/racing/pitsGarageCorner.glb`, size: 12, axis: "x" },
  office: { url: `${BASE}/racing/pitsOffice.glb`, size: 10, axis: "x" },
  tentLong: { url: `${BASE}/racing/tentLong.glb`, size: 10, axis: "x" },
  tent: { url: `${BASE}/racing/tentRoof.glb`, size: 7, axis: "z" },
  tentDouble: { url: `${BASE}/racing/tentRoofDouble.glb`, size: 6, axis: "z" },
  lightPost: { url: `${BASE}/racing/lightPostLarge.glb`, size: 11, axis: "y" },
  bannerRed: { url: `${BASE}/racing/bannerTowerRed.glb`, size: 9, axis: "y" },
  bannerGreen: { url: `${BASE}/racing/bannerTowerGreen.glb`, size: 9, axis: "y" },
  flagCheckers: { url: `${BASE}/racing/flagCheckers.glb`, size: 7, axis: "y" },
  flagRed: { url: `${BASE}/racing/flagRed.glb`, size: 7, axis: "y" },
  flagGreen: { url: `${BASE}/racing/flagGreen.glb`, size: 7, axis: "y" },
  billboard: { url: `${BASE}/racing/billboard.glb`, size: 10, axis: "x" },
  billboardLow: { url: `${BASE}/racing/billboardLow.glb`, size: 10, axis: "x" },
  overheadLights: { url: `${BASE}/racing/overheadLights.glb`, size: 6, axis: "y" },
  radar: { url: `${BASE}/racing/radarEquipment.glb`, size: 4, axis: "y" },
  containerA: { url: `${BASE}/industrial/shipping-container-a.glb`, size: 12.2, axis: "z" },
  containerB: { url: `${BASE}/industrial/shipping-container-b.glb`, size: 12.2, axis: "z" },
  containerC: { url: `${BASE}/industrial/shipping-container-c.glb`, size: 12.2, axis: "z" },
  tankLarge: { url: `${BASE}/industrial/detail-tank-large.glb`, size: 22, axis: "x" },
  tank: { url: `${BASE}/industrial/detail-tank.glb`, size: 9, axis: "x" },
  waterTower: { url: `${BASE}/industrial/water-tower.glb`, size: 28, axis: "y" },
  chimney: { url: `${BASE}/industrial/chimney-large.glb`, size: 34, axis: "y" },
  chimneyMedium: { url: `${BASE}/industrial/chimney-medium.glb`, size: 24, axis: "y" },
  palm: { url: `${BASE}/nature/tree_palmTall.glb`, size: 12, axis: "y" },
  palmDetailed: { url: `${BASE}/nature/tree_palmDetailedTall.glb`, size: 13, axis: "y" },
  treeDefault: { url: `${BASE}/nature/tree_default.glb`, size: 9, axis: "y" },
  treeOak: { url: `${BASE}/nature/tree_oak.glb`, size: 10, axis: "y" },
  treeFat: { url: `${BASE}/nature/tree_fat.glb`, size: 9, axis: "y" },
  pineA: { url: `${BASE}/nature/tree_pineTallA.glb`, size: 15, axis: "y" },
  pineB: { url: `${BASE}/nature/tree_pineTallB.glb`, size: 14, axis: "y" },
  pineC: { url: `${BASE}/nature/tree_pineTallC.glb`, size: 16, axis: "y" },
  pineD: { url: `${BASE}/nature/tree_pineTallD.glb`, size: 13, axis: "y" },
  pineRoundA: { url: `${BASE}/nature/tree_pineRoundA.glb`, size: 10, axis: "y" },
  pineRoundC: { url: `${BASE}/nature/tree_pineRoundC.glb`, size: 11, axis: "y" },
  rockTallA: { url: `${BASE}/nature/rock_tallA.glb`, size: 8, axis: "y" },
  rockTallC: { url: `${BASE}/nature/rock_tallC.glb`, size: 10, axis: "y" },
  rockTallE: { url: `${BASE}/nature/rock_tallE.glb`, size: 7, axis: "y" },
  rockLargeA: { url: `${BASE}/nature/rock_largeA.glb`, size: 6, axis: "x" },
  rockLargeC: { url: `${BASE}/nature/rock_largeC.glb`, size: 6, axis: "x" },
  stoneTall: { url: `${BASE}/nature/stone_tallB.glb`, size: 6, axis: "y" },
  logStack: { url: `${BASE}/nature/log_stack.glb`, size: 4, axis: "z" },
  logStackLarge: { url: `${BASE}/nature/log_stackLarge.glb`, size: 6, axis: "z" },
  fence: { url: `${BASE}/nature/fence_simple.glb`, size: 4, axis: "x" },
  stump: { url: `${BASE}/nature/stump_round.glb`, size: 1.4, axis: "x" },
} as const;

export type PropKind = keyof typeof MODELS;

export interface PropItem {
  kind: PropKind;
  /** Meters. */
  x: number;
  z: number;
  /** Radians about y. */
  rotY: number;
  /** Extra scale on top of the fitted size (1 by default). */
  scale?: number;
  /** Meters above the ground (stacked containers). */
  y?: number;
}
