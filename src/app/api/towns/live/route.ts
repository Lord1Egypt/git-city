import { NextResponse } from "next/server";
import type { TownLive } from "@/lib/towns/live";

export const dynamic = "force-dynamic";

export type { TownLive };

// Who's inside every town right now: one read of the town tally
// (party/townlive), which only lists towns with someone in them. Cached at
// the CDN for 10s, so the tally sees a few requests a minute however many
// visitors /towns has.
export async function GET() {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const base = host.startsWith("http") ? host : `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  let live: Record<string, TownLive> = {};
  try {
    const res = await fetch(`${base}/parties/townlive/main`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (res.ok) live = (await res.json()) as Record<string, TownLive>;
  } catch {
    // tally unreachable: every card just shows no count
  }
  return NextResponse.json(live, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
  });
}
