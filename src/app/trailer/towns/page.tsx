import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  if (sides.some((s) => !s)) notFound();
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
