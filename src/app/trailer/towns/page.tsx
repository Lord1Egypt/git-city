import type { Metadata } from "next";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { getCityNorms, getLeagueCityDevs, getLeagueMembers } from "@/lib/leagues/queries";
import { getCachedCity } from "@/lib/league-city/service";
import { RIVALRY } from "@/lib/towns/rivalry";
import { townDisplayName } from "@/lib/towns/names";
import TownsFilm, { type TownSide } from "./towns-film";

// The Git City Towns teaser in the trailer studio (.claude/skills/game-trailer/kit/README.md):
// played live in the engine so the film is one screen recording. Not linked
// from anywhere.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Towns teaser - Git City",
  robots: { index: false, follow: false },
};

export default async function TownsTeaserPage() {
  const [norms, ...sides] = await Promise.all([getCityNorms(), ...RIVALRY.map(loadSide)]);
  // A fork without the rivalry towns gets told what the example needs, not a bare 404.
  if (sides.some((s) => !s)) return <MissingTowns />;
  return <TownsFilm sides={sides as [TownSide, TownSide]} cityNorms={norms} />;
}

async function loadSide(r: (typeof RIVALRY)[number]): Promise<TownSide | null> {
  const league = await getLeagueBySlug(r.slug);
  if (!league) return null;
  const [members, city] = await Promise.all([
    getLeagueMembers(league.id),
    getCachedCity(league.id),
  ]);
  return {
    slug: r.slug,
    name: townDisplayName(league.name),
    color: r.color,
    city,
    cityDevs: await getLeagueCityDevs(members),
  };
}

function MissingTowns() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 font-pixel text-warm">
      <div className="max-w-xl space-y-3 text-[12px] normal-case leading-relaxed">
        <p className="text-lime uppercase">Towns teaser</p>
        <p>
          This example film plays in Git City&apos;s two rivalry towns,{" "}
          {RIVALRY.map((r) => r.slug).join(" and ")}, and they aren&apos;t in your database. For a
          film that runs anywhere, open /trailer/demo, and start your own from it.
        </p>
        <p className="text-muted">
          The trailer kit and how to make your own film: .claude/skills/game-trailer/kit/README.md
        </p>
      </div>
    </main>
  );
}
