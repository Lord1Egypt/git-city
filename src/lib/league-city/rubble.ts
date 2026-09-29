import { getSupabaseAdmin } from "@/lib/supabase";
import { RIVALRY } from "@/lib/towns/rivalry";

/**
 * Buildings lying in rubble per rivalry town right now (the smash score).
 * Only the other side's kills count: friendly fire knocks buildings down,
 * it doesn't score for the town that did it to itself.
 */
export async function rubbleBySlug(): Promise<Record<string, number>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("town_building_damage")
    .select("demolished_by, leagues!inner(slug)")
    .not("demolished_by", "is", null)
    .in("leagues.slug", RIVALRY.map((r) => r.slug))
    .returns<{ demolished_by: number; leagues: { slug: string } }[]>();
  const rows = data ?? [];
  const killers = [...new Set(rows.map((r) => r.demolished_by))];
  const { data: sides } = killers.length
    ? await sb
        .from("league_members")
        .select("developer_id, leagues!inner(slug)")
        .eq("status", "active")
        .in("developer_id", killers)
        .in("leagues.slug", RIVALRY.map((r) => r.slug))
        .returns<{ developer_id: number; leagues: { slug: string } }[]>()
    : { data: [] };
  const sideOf = new Map((sides ?? []).map((s) => [s.developer_id, s.leagues.slug]));
  const out: Record<string, number> = {};
  for (const r of rows) {
    const side = sideOf.get(r.demolished_by);
    if (!side || side === r.leagues.slug) continue;
    out[r.leagues.slug] = (out[r.leagues.slug] ?? 0) + 1;
  }
  return out;
}

/** Buildings lying in rubble in one town right now, whoever knocked them down. */
export async function rubbleIn(leagueId: string): Promise<number> {
  const { count } = await getSupabaseAdmin()
    .from("town_building_damage")
    .select("developer_id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .not("demolished_by", "is", null);
  return count ?? 0;
}

export interface AttackerTown {
  slug: string;
  name: string;
}

/**
 * Where the attacker's own building stands, to hit it back: the town they hit
 * (friendly fire), else their rivalry side, else the town they joined first.
 * Null when they live in no town.
 */
export async function attackerTown(attackerId: number, hitSlug: string): Promise<AttackerTown | null> {
  const { data } = await getSupabaseAdmin()
    .from("league_members")
    .select("joined_at, leagues!inner(slug, name, hidden)")
    .eq("developer_id", attackerId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .returns<{ joined_at: string | null; leagues: { slug: string; name: string; hidden: boolean | null } }[]>();
  const towns = (data ?? []).map((r) => r.leagues);
  const pick =
    towns.find((t) => t.slug === hitSlug) ??
    towns.find((t) => RIVALRY.some((r) => r.slug === t.slug)) ??
    towns.find((t) => !t.hidden) ??
    towns[0];
  return pick ? { slug: pick.slug, name: pick.name } : null;
}
