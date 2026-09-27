import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getLeagueBySlug, getMembership, getViewer } from "@/lib/leagues/service";
import { leagueTag } from "@/lib/leagues/cache";
import { getCityNorms, getLeagueCityDevs, getLeagueMembers } from "@/lib/leagues/queries";
import { getCachedCity } from "@/lib/league-city/service";
import { getDiscover } from "@/lib/towns/discover";
import { RIVALRY } from "@/lib/towns/rivalry";
import RivalryPoster, { type RivalSide } from "@/components/towns/RivalryPoster";

export const dynamic = "force-dynamic";

const TITLE = "Claude Code vs Codex - Git City";
const DESCRIPTION = "Pick your side. From Monday, the side whose devs code more wins the week.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

// How many faces each side shows under "Who picked".
const FACES = 24;

export default async function TownsPage({ searchParams }: { searchParams: Promise<{ create?: string; pick?: string }> }) {
  const { create, pick } = await searchParams;
  // Old "create" links (emails, sign-in returns) open the new town screen.
  if (create === "1") redirect("/towns/new");

  const [viewer, discover, norms] = await Promise.all([getViewer(), getDiscover(null), getCityNorms()]);
  const load = (r: (typeof RIVALRY)[number]) => loadSide(r, discover.all, norms, viewer?.id ?? null);
  const sides = await Promise.all([load(RIVALRY[0]), load(RIVALRY[1])]);
  const mineIndex = sides.findIndex((s) => s.mine);
  const others = discover.all.filter((t) => !RIVALRY.some((r) => r.slug === t.slug));

  return (
    <RivalryPoster
      sides={sides}
      mine={mineIndex === -1 ? null : (mineIndex as 0 | 1)}
      signedIn={!!viewer}
      pickOnLoad={RIVALRY.some((r) => r.slug === pick) ? (pick as string) : null}
      others={others}
    />
  );
}

async function loadSide(
  r: (typeof RIVALRY)[number],
  grid: Awaited<ReturnType<typeof getDiscover>>["all"],
  cityNorms: Awaited<ReturnType<typeof getCityNorms>>,
  viewerId: number | null,
): Promise<RivalSide & { mine: boolean }> {
  const league = await getLeagueBySlug(r.slug);
  const card = grid.find((t) => t.slug === r.slug);
  const base = { slug: r.slug, name: r.name, color: r.color, cover: card?.cover ?? null, picked: 0, faces: [], hero: null, mine: false };
  if (!league) return base;
  try {
    const [side, mine] = await Promise.all([
      cachedSide(league.id)(),
      viewerId === null ? null : getMembership(league.id, viewerId),
    ]);
    return { ...base, ...side, hero: { ...side.hero, cityNorms }, mine: mine?.status === "active" };
  } catch (err) {
    console.error(`[towns] ${r.slug} failed:`, err);
    return base;
  }
}

// Everything a visitor sees of a side, shared by every visitor. The league's
// tag expires it on every pick or leave (invalidateLeague), so the one who
// picked sees their count right away; everyone else within a minute.
function cachedSide(leagueId: string) {
  return unstable_cache(
    async () => {
      const [members, city] = await Promise.all([getLeagueMembers(leagueId), getCachedCity(leagueId)]);
      const active = members.filter((m) => m.status === "active");
      const newest = [...active].sort((a, b) => (b.joined_at ?? "").localeCompare(a.joined_at ?? ""));
      return {
        picked: active.length,
        faces: newest.slice(0, FACES).map((m) => ({ login: m.login, avatar_url: m.avatar_url })),
        hero: { city, cityDevs: await getLeagueCityDevs(members) },
      };
    },
    ["towns-rivalry-side", leagueId],
    { revalidate: 60, tags: [leagueTag(leagueId)] },
  );
}
