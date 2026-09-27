import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getGhost } from "@/lib/drift/board";
import { getLiveSpot } from "@/lib/drift/spots";

export const dynamic = "force-dynamic";

// GET ?login=x: that driver's best run on this spot, to race as a ghost.
export async function GET(req: Request, { params }: { params: Promise<{ spot: string }> }) {
  const login = new URL(req.url).searchParams.get("login") ?? "";
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return NextResponse.json({ error: "Bad login." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`drift-ghost:${ip}`, 60, 60_000).ok) return NextResponse.json({ error: "Too fast." }, { status: 429 });
  const { spot: id } = await params;
  const spot = getLiveSpot(id);
  if (!spot) return NextResponse.json({ error: "No such spot." }, { status: 404 });
  const ghost = await getGhost(spot.id, login);
  if (!ghost) return NextResponse.json({ error: "No ghost." }, { status: 404 });
  return NextResponse.json(ghost, { headers: { "Cache-Control": "private, max-age=30" } });
}
