import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/leagues/service";
import { getBoard, getMyRow, nextAbove } from "@/lib/drift/board";
import { getLiveSpot } from "@/lib/drift/spots";
import { medalScores } from "@/lib/drift/spots/types";
import SpotClient from "./spot-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ spot: string }>; searchParams: Promise<{ vs?: string; ghost?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { spot: id } = await params;
  const { vs } = await searchParams;
  const spot = getLiveSpot(id);
  if (!spot) return { title: "Drift - Git City" };
  const who = vs && /^[A-Za-z0-9-]{1,39}$/.test(vs) ? vs : null;
  const title = who ? `@${who} challenges you on ${spot.name} - Git City Drift` : `${spot.name} - Git City Drift`;
  const image = { url: `/drift/${spot.id}/og${who ? `?vs=${encodeURIComponent(who)}` : ""}`, width: 1200, height: 630, alt: `${spot.name} in Git City Drift` };
  return {
    title,
    description: spot.tagline,
    openGraph: { title, description: spot.tagline, images: [image] },
    twitter: { card: "summary_large_image", title, description: spot.tagline, images: [image] },
  };
}

const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

export default async function DriftSpotPage({ params, searchParams }: Props) {
  const { spot: id } = await params;
  const { vs, ghost } = await searchParams;
  const spot = getLiveSpot(id);
  if (!spot) notFound();
  const viewer = await getViewer();
  const [board, me] = await Promise.all([
    getBoard(spot.id, "world", 50),
    viewer ? getMyRow(spot.id, viewer.id) : Promise.resolve(null),
  ]);
  // The ghost to race: the one asked for (a challenge link, a board row), else
  // the driver just above you (Mario Kart), else the first run past gold.
  const asked = [vs, ghost].find((l) => l && LOGIN.test(l)) ?? null;
  let rival = asked;
  if (!rival) {
    const gold = medalScores(spot).find(([m]) => m === "gold")![1];
    const above = await nextAbove(spot.id, me?.score ?? gold - 1, viewer?.id ?? -1);
    rival = above?.login ?? null;
  }
  return (
    <SpotClient
      spotId={spot.id}
      viewerLogin={viewer?.github_login ?? null}
      boardScores={board.map((r) => r.score)}
      board={board.slice(0, 50).map((r) => ({ rank: r.rank, login: r.login, score: r.score }))}
      myBest={me?.score ?? null}
      rivalLogin={rival && rival.toLowerCase() !== viewer?.github_login.toLowerCase() ? rival : null}
      challenger={vs && LOGIN.test(vs) ? vs : null}
    />
  );
}
