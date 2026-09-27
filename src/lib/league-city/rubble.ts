import { getSupabaseAdmin } from "@/lib/supabase";
import { RIVALRY } from "@/lib/towns/rivalry";

/** Buildings lying in rubble per rivalry town right now (the smash score). */
export async function rubbleBySlug(): Promise<Record<string, number>> {
  const { data } = await getSupabaseAdmin()
    .from("town_building_damage")
    .select("leagues!inner(slug)")
    .not("demolished_by", "is", null)
    .in("leagues.slug", RIVALRY.map((r) => r.slug))
    .returns<{ leagues: { slug: string } }[]>();
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.leagues.slug] = (out[r.leagues.slug] ?? 0) + 1;
  return out;
}
