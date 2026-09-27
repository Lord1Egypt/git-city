import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isoDay, weekStart, type TownScore } from "@/lib/leagues/scoring";
import { leagueAssetUrl } from "@/lib/league-city/identity";
import { pickTownOfWeek } from "./featured";

/** The monument's town: this week's Town of the week and the score that won it. */
export interface TownOfWeek {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  perDev: number;
  coding: number;
}

/**
 * This week's Town of the week (featured_week = this Monday) with last week's
 * score. Null when no town won this week or the winner was hidden since.
 * Cached 5 minutes; the Monday close changes it once a week.
 */
export const getTownOfWeek = unstable_cache(
  async (): Promise<TownOfWeek | null> => {
    const sb = getSupabaseAdmin();
    const monday = weekStart(new Date());
    const { data: town } = await sb
      .from("leagues")
      .select("id, slug, name")
      .eq("featured_week", isoDay(monday))
      .eq("hidden", false)
      .limit(1)
      .maybeSingle();
    if (!town) return null;
    const won = new Date(monday);
    won.setUTCDate(won.getUTCDate() - 7);
    const [{ data: week }, { data: city }] = await Promise.all([
      sb.from("league_weeks").select("standings").eq("league_id", town.id).eq("week_start", isoDay(won)).maybeSingle(),
      sb
        .from("league_cities")
        .select("logo:league_assets!league_cities_logo_asset_id_fkey(path, status)")
        .eq("league_id", town.id)
        .maybeSingle()
        .returns<{ logo: { path: string; status: string } | null } | null>(),
    ]);
    const score = (week?.standings as { town?: TownScore | null } | null)?.town ?? null;
    return {
      id: town.id as string,
      slug: town.slug as string,
      name: town.name as string,
      logoUrl: city?.logo?.status === "active" ? leagueAssetUrl(city.logo.path) : null,
      perDev: score?.perDev ?? 0,
      coding: score?.coding ?? 0,
    };
  },
  ["town-of-week-v1"],
  { revalidate: 300 },
);

export interface TownWeekResult {
  rolled_up: number;
  /** Town of the week, or null when no town was ranked. */
  featured: { id: string; slug: string; name: string } | null;
}

/**
 * Monday step after the race close: rolls last week's visits into
 * town_visits_weekly (Trending reads them), then features Town of the week,
 * the top of the close's town ranking, for the week that starts now and
 * grants its admin the emblem. Safe to rerun: the rollup overwrites, the
 * emblem's claim key is per town per week.
 */
export async function closeTownWeek(start: Date, ranked: string[]): Promise<TownWeekResult> {
  const sb = getSupabaseAdmin();
  const week = isoDay(start);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 7);
  const featuredWeek = isoDay(next);

  const { data: rolled, error } = await sb.rpc("rollup_town_visits", { p_week_start: week });
  if (error) throw error;

  const winner = pickTownOfWeek(ranked, await overrideId());
  if (!winner) return { rolled_up: (rolled as number | null) ?? 0, featured: null };

  // A rerun that picks another town moves the spot instead of sharing it.
  await sb.from("leagues").update({ featured_week: null }).eq("featured_week", featuredWeek).neq("id", winner);
  const { data: town, error: setError } = await sb
    .from("leagues")
    .update({ featured_week: featuredWeek })
    .eq("id", winner)
    .select("id, slug, name, admin_id")
    .single();
  if (setError) throw setError;

  if (town.admin_id) {
    await sb.rpc("grant_emblem", {
      p_developer_id: town.admin_id,
      p_emblem_id: "town_of_week",
      p_claim_key: `town_of_week:${town.id}:${week}`,
      p_meta: { league_id: town.id, week_start: week },
      p_source: "town",
    });
  }
  return { rolled_up: (rolled as number | null) ?? 0, featured: { id: town.id as string, slug: town.slug as string, name: town.name as string } };
}

/** TOWN_OF_WEEK_OVERRIDE holds a town slug: a staff pick that beats the ranking. */
async function overrideId(): Promise<string | null> {
  const slug = process.env.TOWN_OF_WEEK_OVERRIDE?.trim().toLowerCase();
  if (!slug) return null;
  const { data } = await getSupabaseAdmin().from("leagues").select("id").eq("slug", slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
