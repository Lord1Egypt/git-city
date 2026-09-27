import { isRivalry } from "@/lib/towns/rivalry";
import { renderDemolishedImage } from "@/lib/og/demolishedImage";

// The town_demolished email's hero: ?attacker=<login>&victim=<login>. The
// score in rubble moves, so it's cached a day, not forever (each email adds
// its own `v`).
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isRivalry(slug)) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const image = await renderDemolishedImage(slug, q.get("attacker") ?? "", q.get("victim") ?? "");
  image.headers.set("Cache-Control", "public, max-age=86400");
  return image;
}
