import type { Metadata } from "next";
import { headers } from "next/headers";
import { getViewer } from "@/lib/leagues/service";
import { boardSize, getBoard, getDriftCountry, getMyRow } from "@/lib/drift/board";
import { SPOTS } from "@/lib/drift/spots";
import DriftClient, { type SpotBoard } from "./drift-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drift - Git City",
  description: "Drift spots outside every town. One board for everyone, by the world and by country.",
};

export default async function DriftPage({ searchParams }: { searchParams: Promise<{ spot?: string }> }) {
  const { spot } = await searchParams;
  const viewer = await getViewer();
  const live = SPOTS.filter((s) => s.status === "live");
  const [boards, country] = await Promise.all([
    Promise.all(
      live.map(async (s): Promise<[string, SpotBoard]> => {
        const [rows, total, me] = await Promise.all([
          getBoard(s.id, "world", 10),
          boardSize(s.id, "world"),
          viewer ? getMyRow(s.id, viewer.id, "world") : Promise.resolve(null),
        ]);
        return [s.id, { rows: rows.map((r) => ({ rank: r.rank, login: r.login, score: r.score })), total, me: me ? { rank: me.rank, login: me.login, score: me.score } : null }];
      }),
    ),
    viewer ? getDriftCountry(viewer.id) : Promise.resolve(null),
  ]);
  const ip = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;
  return (
    <DriftClient
      boards={Object.fromEntries(boards)}
      viewerLogin={viewer?.github_login ?? null}
      country={country ?? (ip && /^[A-Z]{2}$/.test(ip) ? ip : null)}
      initial={live.some((s) => s.id === spot) ? spot! : live[0].id}
    />
  );
}
