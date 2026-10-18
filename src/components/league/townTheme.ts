import { THEMES, type CityTheme } from "@/components/city/theme";

// Towns use Midnight with more light: brighter ambient and sky, a lighter
// ground and sidewalks, so the city reads at a glance. Same buildings and
// window colors as the main city.
const MIDNIGHT = THEMES[1];
const TOWN_MIDNIGHT: CityTheme = {
  ...MIDNIGHT,
  fogColor: "#10203a",
  fogNear: 700,
  fogFar: 5000,
  ambientColor: "#6a88d0",
  ambientIntensity: 1.0,
  sunColor: "#a8c0f0",
  sunIntensity: 1.15,
  fillColor: "#5068b0",
  fillIntensity: 0.55,
  hemiSky: "#7aa0d0",
  hemiGround: "#34404e",
  hemiIntensity: 0.95,
  groundColor: "#2f3b50",
  grid1: "#465670",
  grid2: "#3a4860",
  roadMarkingColor: "#b8c4d4",
  sidewalkColor: "#646a7c",
};
// Keys the tuned Midnight's lights and sky (a value of its own, apart from the main city's).
const TOWN_MIDNIGHT_KEY = 11;

// The main city's Emerald, brightened the way Midnight is for towns: the same
// light levels, in greens. The Brasil map's night (green country, lime windows).
const EMERALD = THEMES[0];
const TOWN_EMERALD: CityTheme = {
  ...EMERALD,
  fogColor: "#1a4260",
  fogNear: 700,
  fogFar: 5000,
  ambientColor: "#7ac890",
  ambientIntensity: 1.0,
  sunColor: "#b8ecc6",
  sunIntensity: 1.15,
  fillColor: "#50a080",
  fillIntensity: 0.55,
  hemiSky: "#8ad0a0",
  hemiGround: "#2f4a38",
  hemiIntensity: 0.95,
  groundColor: "#2a4334",
  grid1: "#3c5c4a",
  grid2: "#32503f",
  roadMarkingColor: "#c8dcc8",
  sidewalkColor: "#66786c",
  building: { ...EMERALD.building, face: "#12221a", roof: "#2a5038" },
};
const TOWN_EMERALD_KEY = 12;

/** The town-bright Emerald (the Brasil map). */
export function townEmerald(): { theme: CityTheme; key: number; fx: 0 | 1 | 2 | 3 } {
  return { theme: TOWN_EMERALD, key: TOWN_EMERALD_KEY, fx: 3 };
}
export const EXPOSURE = 1.65;
const DEFAULT_SKY = 1; // Midnight

/**
 * The town's sky from settings (THEMES order: Emerald, Midnight, Sunset,
 * Neon). Midnight is the brighter town tuning above; the others are the main
 * city's themes as they are.
 */
export function townTheme(sky: number): { theme: CityTheme; key: number; fx: 0 | 1 | 2 | 3 } {
  // ThemeSkyFX orders its moons and stars Midnight, Sunset, Neon, Emerald.
  const fx = ([3, 0, 1, 2] as const)[sky] ?? 0;
  if (sky === DEFAULT_SKY || !THEMES[sky]) return { theme: TOWN_MIDNIGHT, key: TOWN_MIDNIGHT_KEY, fx: 0 };
  return { theme: THEMES[sky], key: sky, fx };
}
