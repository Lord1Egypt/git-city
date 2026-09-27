import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isoDay, rankTowns, STANDINGS_VERSION } from "./scoring";
import { loadStandings, type LeagueWeekStandings } from "./standings";

export const WINNER_XP = 100;
/** Pixel prize for winners of leagues with 5+ active members. Open question in the spec; tune later. */
export const WINNER_PIXELS = 50;
export const PIXEL_MIN_ACTIVE = 5;
export const CROWN_DAYS = 7;

export interface ClosedLeague {
  league: { id: string; slug: string; name: string; kind: string };
  week: LeagueWeekStandings;
  winnerId: number | null;
  /** Place among ranked towns (3+ members coding). Null when unranked. */
  townRank: number | null;
  townTotal: number;
}

export interface CloseWeekResult {
  closed: ClosedLeague[];
  errors: number;
  /** Ranked town ids, best first: the first is the Town of the week. */
  ranked: string[];
}

/**
 * Closes one week for every league with 1+ active member: freezes standings,
 * crowns the winner, grants the emblem, XP and (5+ active) pixels. Safe to
 * run twice: league_weeks PK, the crown unique key and both claim keys make
 * every step idempotent.
 */
export async function closeWeek(start: Date): Promise<CloseWeekResult> {
  const sb = getSupabaseAdmin();
  const week = isoDay(start);
  const { data: leagues, error } = await sb.from("leagues").select("id, slug, name, kind, hidden, created_at");
  if (error) throw error;

  const standings = await loadStandings((leagues ?? []).map((l) => ({ id: l.id as string })), start, sb);

  // Town vs town: visible towns with 3+ members coding.
  const ranked = rankTowns(
    (leagues ?? [])
      .filter((l) => !l.hidden)
      .map((l) => ({ id: l.id as string, created_at: l.created_at as string | null, score: standings.get(l.id)?.town ?? null })),
  );
  const townRank = new Map(ranked.map((t) => [t.id, t.rank]));

  const closed: ClosedLeague[] = [];
  let errors = 0;
  const expiresAt = new Date(Date.now() + CROWN_DAYS * 86_400_000).toISOString();

  for (const league of leagues ?? []) {
    const s = standings.get(league.id);
    if (!s || s.standings.length === 0) continue;
    try {
      const leader = s.standings[0];
      const winnerId = leader && leader.total > 0 ? leader.developer_id : null;

      await sb.from("league_weeks").upsert(
        {
          league_id: league.id,
          week_start: week,
          winner_id: winnerId,
          standings: {
            version: STANDINGS_VERSION,
            standings: s.standings,
            town: s.town,
            town_rank: townRank.get(league.id) ?? null,
          },
        },
        { onConflict: "league_id,week_start", ignoreDuplicates: true },
      );

      // Rewards follow the frozen row, so a re-run can't pick a different winner.
      const { data: frozen } = await sb
        .from("league_weeks")
        .select("winner_id")
        .eq("league_id", league.id)
        .eq("week_start", week)
        .single();
      const frozenWinner = (frozen?.winner_id as number | null) ?? null;

      if (frozenWinner) {
        const claimKey = `league:${league.id}:${week}`;
        await sb
          .from("league_crowns")
          .upsert(
            { developer_id: frozenWinner, league_id: league.id, week_start: week, expires_at: expiresAt },
            { onConflict: "developer_id,week_start", ignoreDuplicates: true },
          );
        await sb.rpc("grant_emblem", {
          p_developer_id: frozenWinner,
          p_emblem_id: "league_champion",
          p_claim_key: claimKey,
          p_meta: { league_id: league.id, league_slug: league.slug, league_name: league.name, week_start: week },
          p_source: "league",
        });
        const { error: rewardErr } = await sb.rpc("grant_league_reward", {
          p_developer_id: frozenWinner,
          p_league_id: league.id,
          p_week_start: week,
          p_xp: WINNER_XP,
          p_pixels: s.standings.length >= PIXEL_MIN_ACTIVE ? WINNER_PIXELS : 0,
          p_claim_key: claimKey,
        });
        if (rewardErr) throw rewardErr;
      }

      closed.push({
        league: { id: league.id, slug: league.slug, name: league.name, kind: league.kind },
        week: s,
        winnerId: frozenWinner,
        townRank: townRank.get(league.id) ?? null,
        townTotal: ranked.length,
      });
    } catch (err) {
      errors++;
      console.error(`[league-close] ${league.slug}:`, err);
    }
  }

  return { closed, errors, ranked: ranked.map((t) => t.id) };
}
