import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getViewer } from "@/lib/leagues/service";
import { attackerTown } from "@/lib/league-city/rubble";
import { townDisplayName } from "@/lib/towns/names";

export const dynamic = "force-dynamic";

// GET: your buildings that fell in the last 7 days, most recent first, for
// the "while you were away" box (AwayCard). The box keeps what you already
// saw, so this only lists. The last one comes with where its attacker lives,
// for Smash back (the knocked-down email's link).

const WINDOW_MS = 7 * 86_400_000;

export interface AwayFall {
  attacker: string;
  town: string;
  fellAt: string;
}

export interface AwayResponse {
  falls: AwayFall[];
  hitBack: { login: string; slug: string } | null;
}

interface Row {
  attacker_id: number;
  fell_at: string;
  leagues: { slug: string; name: string } | null;
  attacker: { github_login: string } | null;
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ falls: [], hitBack: null } satisfies AwayResponse);
  const { data, error } = await getSupabaseAdmin()
    .from("town_demolitions")
    .select("attacker_id, fell_at, leagues(slug, name), attacker:developers!town_demolitions_attacker_id_fkey(github_login)")
    .eq("victim_id", viewer.id)
    .gte("fell_at", new Date(Date.now() - WINDOW_MS).toISOString())
    .order("fell_at", { ascending: false })
    .limit(10)
    .returns<Row[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).filter((r) => r.attacker && r.leagues);
  const falls: AwayFall[] = rows.map((r) => ({ attacker: r.attacker!.github_login, town: townDisplayName(r.leagues!.name), fellAt: r.fell_at }));
  const last = rows[0];
  const town = last ? await attackerTown(last.attacker_id, last.leagues!.slug).catch(() => null) : null;
  return NextResponse.json(
    { falls, hitBack: town && last ? { login: last.attacker!.github_login, slug: town.slug } : null } satisfies AwayResponse,
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
