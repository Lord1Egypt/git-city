import { NextResponse } from "next/server";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { isRivalry } from "@/lib/towns/rivalry";
import { getDamage, getSmashTown, saveDamage, verifySmashSave, weekContribs } from "@/lib/league-city/smash-server";
import { notifyDemolished } from "@/lib/notification-senders/town-demolished";

export const dynamic = "force-dynamic";

// GET: a rivalry town's smash state: its buildings as targets (for the drive
// room) and their saved damage (for everyone). ?contrib=1 only returns the
// damaged owners' contributions this week (the room grows floors back from
// them). Public: it's what anyone sees in the town.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isRivalry(slug)) return NextResponse.json({ error: "Not a rivalry town." }, { status: 404 });
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "Town not found." }, { status: 404 });
  try {
    const town = await getSmashTown(league.id);
    const damage = await getDamage(league.id, town);
    if (new URL(req.url).searchParams.get("contrib") === "1") {
      const byId = await weekContribs(damage.map((d) => town.devIds[d.login]));
      const contrib = Object.fromEntries(damage.map((d) => [d.login, byId.get(town.devIds[d.login]) ?? 0]));
      return NextResponse.json({ contrib }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(
      { targets: town.targets, damage, now: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } },
    );
  } catch (err) {
    console.error("[smash:read]", err);
    return NextResponse.json({ error: "Couldn't load the town's damage." }, { status: 500 });
  }
}

// POST: the drive room's save, signed (x-smash-signature). Writes the damaged
// buildings and emails whoever's building just fell.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isRivalry(slug)) return NextResponse.json({ error: "Not a rivalry town." }, { status: 404 });
  const body = await req.text();
  const save = verifySmashSave(slug, body, req.headers.get("x-smash-signature"));
  if (!save) return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "Town not found." }, { status: 404 });
  try {
    const town = await getSmashTown(league.id);
    await saveDamage(league.id, town, save);
    for (const d of save.demolished.slice(0, 20)) await notifyDemolished(league, town, d.victim, d.attacker);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[smash:save]", err);
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
}
