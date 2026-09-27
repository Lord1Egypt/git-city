import { NextResponse } from "next/server";
import { getViewer } from "@/lib/leagues/service";
import { assertSameOrigin } from "@/lib/leagues/http";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getBoard, getDriftCountry, nextAbove, recordRun, setDriftCountry } from "@/lib/drift/board";
import { courseOf, getLiveSpot } from "@/lib/drift/spots";
import { validateRun } from "@/lib/drift/validate";

export const dynamic = "force-dynamic";

/** Four minutes of frames is ~150 KB of JSON; anything much bigger isn't a run. */
const MAX_BODY = 250_000;

// POST {frames, score}: a finished drift run. The frames are checked and
// scored again here (lib/drift/validate.ts); the server's score is the one
// kept. The driver's country comes from their setting, or the request's IP
// country the first time. Returns the best, both ranks, both board sizes, who
// this run passed, the next driver above and the rows around yours.
export async function POST(req: Request, { params }: { params: Promise<{ spot: string }> }) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to post runs." }, { status: 401 });
  if (!rateLimit(`drift-run:${viewer.id}`, 20, 60_000).ok) return NextResponse.json({ error: "Too fast." }, { status: 429 });

  const { spot: id } = await params;
  const spot = getLiveSpot(id);
  if (!spot) return NextResponse.json({ error: "No such spot." }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Too big." }, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // an empty body fails validation below
  }
  const check = validateRun(courseOf(spot), body.frames, body.score, spot.minMs);
  if (!check.ok) {
    console.warn(`[drift] rejected run on ${spot.id} by ${viewer.github_login}: ${check.reason}`);
    return NextResponse.json({ error: "Invalid run.", reason: check.reason }, { status: 400 });
  }

  let country = await getDriftCountry(viewer.id);
  if (!country) {
    const ip = req.headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
    if (/^[A-Z]{2}$/.test(ip) && (await setDriftCountry(viewer.id, ip))) country = ip;
  }

  const saved = await recordRun(spot.id, viewer.id, check.score, country, { frames: body.frames as number[], splits: check.splits });
  if (!saved) return NextResponse.json({ error: "Couldn't save the run." }, { status: 500 });

  // The timing tower: the two drivers above your best and the two below.
  const [passed, next, around] = await Promise.all([
    saved.passed.length
      ? getSupabaseAdmin().from("developers").select("id, github_login").in("id", saved.passed)
      : Promise.resolve({ data: [] as { id: number; github_login: string }[] }),
    nextAbove(spot.id, saved.best, viewer.id),
    getBoard(spot.id, "world", 5, Math.max(0, saved.rank_world - 3)),
  ]);
  const logins = new Map(((passed.data ?? []) as { id: number; github_login: string }[]).map((d) => [d.id, d.github_login]));

  return NextResponse.json({
    score: check.score,
    best: saved.best,
    improved: saved.improved,
    rankWorld: saved.rank_world,
    rankCountry: saved.rank_country,
    totalWorld: saved.total_world,
    totalCountry: saved.total_country,
    country,
    passed: saved.passed.map((id) => logins.get(id)).filter(Boolean),
    next: next ? { login: next.login, score: next.score, rank: next.rank } : null,
    around: around.map((r) => ({ rank: r.rank, login: r.login, score: r.score })),
  });
}
