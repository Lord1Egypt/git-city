import type { Metadata } from "next";
import { getLeagueBySlug } from "@/lib/leagues/service";
import { getCityNorms, getLeagueCityDevs, getLeagueMembers } from "@/lib/leagues/queries";
import { getCachedCity } from "@/lib/league-city/service";
import { RIVALRY } from "@/lib/towns/rivalry";
import { townDisplayName } from "@/lib/towns/names";
import TownsFilm, { type TeaserSide } from "./towns-film";

// The Git City Towns teaser in the trailer studio (tools/trailer/README.md):
// played live in the engine so the film is one screen recording. Not linked
// from anywhere.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Towns teaser - Git City",
  robots: { index: false, follow: false },
};

export default async function TeaserPage() {
  const [norms, ...sides] = await Promise.all([getCityNorms(), ...RIVALRY.map(loadSide)]);
  // A fork without the rivalry towns gets told what the example needs, not a bare 404.
  if (sides.some((s) => !s)) return <MissingTowns />;
  return <TownsFilm sides={sides as [TeaserSide, TeaserSide]} cityNorms={norms} />;
}

async function loadSide(r: (typeof RIVALRY)[number]): Promise<TeaserSide | null> {
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
          This example film plays in the two rivalry towns,{" "}
          {RIVALRY.map((r) => r.slug).join(" and ")}, and neither was found in your database. Create
          them (or point RIVALRY in src/lib/towns/rivalry.ts at two towns you have) and reload.
        </p>
        <p className="text-muted">
          The trailer kit and how to make your own film: tools/trailer/README.md
        </p>
      </div>
    </main>
  );
}
