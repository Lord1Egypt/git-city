import { NextResponse } from "next/server";
import { getViewer } from "@/lib/leagues/service";
import { assertSameOrigin, readJson } from "@/lib/leagues/http";
import { rateLimit } from "@/lib/rate-limit";
import { setDriftCountry } from "@/lib/drift/board";

export const dynamic = "force-dynamic";

// POST {country: "BR"}: the country the viewer's runs count for (every spot).
export async function POST(req: Request) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimit(`drift-country:${viewer.id}`, 10, 60_000).ok) return NextResponse.json({ error: "Too fast." }, { status: 429 });
  const { country } = await readJson(req);
  if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: "Bad country." }, { status: 400 });
  if (!(await setDriftCountry(viewer.id, country))) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ country });
}
