import "server-only";
import { unstable_cache } from "next/cache";
import { getDiscover } from "@/lib/towns/discover";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { getLeagueMembers } from "@/lib/leagues/queries";
import { loadLeagueStandings } from "@/lib/leagues/standings";
import { weekStart } from "@/lib/leagues/scoring";

// The real community town the page shows as its example.
const EXAMPLE_SLUG = "fulldev";
const FACES = 7;

export interface ExampleTown {
  slug: string;
  name: string;
  cover: string | null;
  logoUrl: string | null;
  buildings: number | null;
  /** This week's top coder; null before anyone codes. */
  leader: { login: string; avatar: string | null; total: number } | null;
  /** This week's place among ranked towns and per dev by day, Mon..Sun. */
  rank: { rank: number; perDev: number; days: number[] } | null;
  /** Newest members first, a few faces plus how many more. */
  faces: { login: string; avatar: string | null }[];
  moreFaces: number;
}

async function load(): Promise<ExampleTown | null> {
  const [discover, league] = await Promise.all([getDiscover(null), getLeagueBySlug(EXAMPLE_SLUG)]);
  const card = discover.all.find((t) => t.slug === EXAMPLE_SLUG);
  if (!card || !league) return null;
  const [standings, members] = await Promise.all([
    loadLeagueStandings(league, weekStart(new Date())),
    getLeagueMembers(league.id),
  ]);
  const top = standings.standings[0];
  const row = discover.week.find((t) => t.slug === EXAMPLE_SLUG);
  const active = members
    .filter((m) => m.status === "active")
    .sort((a, b) => (b.joined_at ?? "").localeCompare(a.joined_at ?? ""));
  return {
    slug: card.slug,
    name: card.name,
    cover: card.cover,
    logoUrl: card.logoUrl,
    buildings: card.buildings,
    leader: top && top.total > 0 ? { login: top.login, avatar: top.avatar_url, total: top.total } : null,
    rank: row ? { rank: row.rank, perDev: row.per_dev, days: row.days } : null,
    faces: active.slice(0, FACES).map((m) => ({ login: m.login, avatar: m.avatar_url })),
    moreFaces: Math.max(0, active.length - FACES),
  };
}

export const getExampleTown = unstable_cache(async () => load().catch(() => null), ["communities-example"], {
  revalidate: 300,
});
