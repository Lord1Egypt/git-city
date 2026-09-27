import { NextResponse } from "next/server";
import { getViewer } from "@/lib/leagues/service";
import { rateLimit } from "@/lib/rate-limit";
import { boardSize, getBoard, getMyRow } from "@/lib/drift/board";
import { getLiveSpot } from "@/lib/drift/spots";

export const dynamic = "force-dynamic";

// GET ?scope=world|BR: a spot's board (top 50), its size, and the viewer's own
// row on it even when far outside the top.
export async function GET(req: Request, { params }: { params: Promise<{ spot: string }> }) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "world";
  if (scope !== "world" && !/^[A-Z]{2}$/.test(scope)) return NextResponse.json({ error: "Bad scope." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`drift-board:${ip}`, 60, 60_000).ok) return NextResponse.json({ error: "Too fast." }, { status: 429 });
  const { spot: id } = await params;
  const spot = getLiveSpot(id);
  if (!spot) return NextResponse.json({ error: "No such spot." }, { status: 404 });
  const viewer = await getViewer();
  const [rows, total, me] = await Promise.all([
    getBoard(spot.id, scope),
    boardSize(spot.id, scope),
    viewer ? getMyRow(spot.id, viewer.id, scope) : Promise.resolve(null),
  ]);
  return NextResponse.json({ rows, total, me }, { headers: { "Cache-Control": "private, max-age=10" } });
}
