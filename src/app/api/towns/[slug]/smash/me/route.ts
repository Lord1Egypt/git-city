import { NextResponse } from "next/server";
import { isRivalry } from "@/lib/towns/rivalry";
import { smashViewer } from "@/lib/league-city/smash-server";

export const dynamic = "force-dynamic";

// GET with `Authorization: Bearer <supabase access token>`: who that is and
// whether they're on the other side of this town. The drive room asks when a
// driver says hello; it never trusts the client's own word on its side.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isRivalry(slug)) return NextResponse.json({ error: "Not a rivalry town." }, { status: 404 });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || token.length > 4096) return NextResponse.json({ error: "No token." }, { status: 401 });
  const viewer = await smashViewer(token, slug).catch(() => null);
  if (!viewer) return NextResponse.json({ error: "Unknown viewer." }, { status: 401 });
  return NextResponse.json(viewer, { headers: { "Cache-Control": "private, no-store" } });
}
