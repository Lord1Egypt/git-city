import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { leagueTag } from "@/lib/leagues/cache";
import { RIVALRY } from "@/lib/towns/rivalry";

// GET: how many devs picked each side, for the home's pick-a-side card. A head
// count per league, cached a minute and expired on every pick like /towns.
function cachedPicked(leagueId: string) {
  return unstable_cache(
    async () => {
      const { count } = await getSupabaseAdmin()
        .from("league_members")
        .select("developer_id", { count: "exact", head: true })
        .eq("league_id", leagueId)
        .eq("status", "active");
      return count ?? 0;
    },
    ["towns-rivalry-picked", leagueId],
    { revalidate: 60, tags: [leagueTag(leagueId)] },
  );
}

export async function GET() {
  try {
    const picked = await Promise.all(
      RIVALRY.map(async (r) => {
        const league = await getLeagueBySlug(r.slug);
        return league ? cachedPicked(league.id)() : 0;
      }),
    );
    return NextResponse.json({ picked }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    console.error("[towns] rivalry picked failed:", err);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
