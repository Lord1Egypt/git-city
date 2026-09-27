// ─── The city across the water ──────────────────────────────
// Drift spots sit outside Git City, looking back at it: the skyline on the
// horizon is the real city's biggest developers, their buildings at their
// main-city sizes. Server only; cached for an hour.

import { unstable_cache } from "next/cache";
import { CITY_DEV_COLUMNS, loadCityExtras, mergeCityExtras } from "@/lib/city-extras";
import { getCityNorms } from "@/lib/leagues/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { LayoutNorms } from "@/lib/city-layout-core";

export const SKYLINE_SIZE = 140;

export const getSkyline = unstable_cache(
  async (): Promise<{ devs: Record<string, unknown>[]; norms: LayoutNorms }> => {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("developers")
      .select(CITY_DEV_COLUMNS)
      .not("rank", "is", null)
      .order("rank", { ascending: true })
      .limit(SKYLINE_SIZE)
      .returns<{ id: number; rank: number | null }[]>();
    const devs = data ?? [];
    const [extras, norms] = await Promise.all([loadCityExtras(sb, devs.map((d) => d.id)), getCityNorms()]);
    return { devs: mergeCityExtras(devs, extras), norms };
  },
  ["drift-skyline"],
  { revalidate: 3600 },
);
