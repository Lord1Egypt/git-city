import { NextResponse } from "next/server";
import { getLeagueBySlug, getViewer } from "@/lib/leagues/service";
import { assertSameOrigin, readJson } from "@/lib/leagues/http";
import { captureServer } from "@/lib/posthog-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseUF } from "@/lib/towns/brasil-map";
import { placeBrasilResident } from "@/lib/towns/brasil-server";

export const dynamic = "force-dynamic";

/** A resident can move to another state once a week. */
const MOVE_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

// POST { uf: "SP" | null }: put the signed-in dev on the Brasil map in that
// state (null: the island), or move them there. Their lot is chosen once
// and kept (lib/towns/brasil-server).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const league = await getLeagueBySlug(slug);
  if (!league || league.map !== "brasil") return NextResponse.json({ error: "Town not found." }, { status: 404 });

  const body = await readJson(req);
  const uf = body.uf === null ? null : typeof body.uf === "string" ? parseUF(body.uf) : undefined;
  if (uf === undefined) return NextResponse.json({ error: "Pick a state." }, { status: 400 });

  const { data: current } = await getSupabaseAdmin()
    .from("brasil_residents")
    .select("uf, placed_at")
    .eq("league_id", league.id)
    .eq("developer_id", viewer.id)
    .maybeSingle<{ uf: string | null; placed_at: string }>();
  if (current && current.uf !== uf && Date.now() - Date.parse(current.placed_at) < MOVE_EVERY_MS) {
    const next = new Date(Date.parse(current.placed_at) + MOVE_EVERY_MS);
    return NextResponse.json({ error: `You can move again on ${next.toUTCString().slice(0, 16)}.` }, { status: 429 });
  }

  try {
    const out = await placeBrasilResident(league, { id: viewer.id, login: viewer.github_login }, uf, "site", true);
    if (out.status !== "already") {
      await captureServer(viewer.github_login.toLowerCase(), out.status === "added" ? "brasil_resident_added" : "brasil_resident_moved", { uf, source: "site" });
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[brasil] place", err);
    return NextResponse.json({ error: "Couldn't put you on the map. Try again." }, { status: 500 });
  }
}
