import { NextResponse } from "next/server";
import { getLeagueBySlug, getViewer, joinLeague } from "@/lib/leagues/service";
import { assertSameOrigin, leagueErrorResponse, readJson } from "@/lib/leagues/http";
import { captureServer } from "@/lib/posthog-server";
import { isRivalry } from "@/lib/towns/rivalry";
import { LOGIN_RE } from "@/lib/leagues/names";

export const dynamic = "force-dynamic";

// POST { ref?, t? }: join a custom league: invited members, or anyone with
// the league's invite token (t).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "Town not found." }, { status: 404 });

  const body = await readJson(req);
  const ref = typeof body.ref === "string" && LOGIN_RE.test(body.ref) ? body.ref.toLowerCase() : null;
  try {
    const out = await joinLeague(viewer, league, ref, typeof body.t === "string" ? body.t : null);
    if (out.joined) {
      const rivalry = isRivalry(league.slug);
      const login = viewer.github_login.toLowerCase();
      await captureServer(login, "town_joined", {
        town_slug: league.slug,
        is_rivalry: rivalry,
        side: rivalry ? league.slug : null,
        switched_from: out.switchedFrom,
        via: out.via,
        ref: ref && ref !== login ? ref : null,
      });
    }
    return NextResponse.json({ status: out.status });
  } catch (err) {
    return leagueErrorResponse(err);
  }
}
