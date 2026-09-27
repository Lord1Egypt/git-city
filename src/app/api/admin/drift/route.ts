import { NextResponse } from "next/server";
import { getAuthUser, isAdminUser } from "@/lib/auth-identity";
import { assertSameOrigin, readJson } from "@/lib/leagues/http";
import { removeRun } from "@/lib/drift/board";
import { getLiveSpot } from "@/lib/drift/spots";

export const dynamic = "force-dynamic";

// DELETE {spot, login}: takes a driver's run off a spot's board. Admins only.
export async function DELETE(req: Request) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  if (!isAdminUser(await getAuthUser())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { spot: id, login } = await readJson(req);
  const spot = typeof id === "string" ? getLiveSpot(id) : null;
  if (!spot || typeof login !== "string" || !/^[A-Za-z0-9_-]{1,39}$/.test(login)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (!(await removeRun(spot.id, login))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
