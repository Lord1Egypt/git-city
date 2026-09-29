import { getLeagueBySlug } from "@/lib/leagues/service";
import { demolishedPair, renderDemolishedImage } from "@/lib/og/demolishedImage";

// The town_demolished email's hero: ?a=<attacker id>&d=<victim id>, a fall
// this town logged (older emails: ?attacker=<login>&victim=<login>). The count
// in rubble moves, so it's cached a day, not forever (each email adds its own `n`).
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return new Response("Not found", { status: 404 });
  const pair = await demolishedPair(league.id, new URL(req.url).searchParams);
  if (!pair) return new Response("Not found", { status: 404 });
  const image = await renderDemolishedImage(league.slug, ...pair);
  image.headers.set("Cache-Control", "public, max-age=86400");
  return image;
}
