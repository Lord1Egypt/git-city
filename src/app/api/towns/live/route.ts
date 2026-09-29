import { NextResponse } from "next/server";
import { RIVALRY } from "@/lib/towns/rivalry";

export const dynamic = "force-dynamic";

export interface TownLive {
  driving: number;
  watching: number;
}

// Who's inside each rivalry town right now, from its drive room. Cached at the
// CDN for 10s, so PartyKit sees a few requests a minute however many visitors
// /towns has.
export async function GET() {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const base = host.startsWith("http") ? host : `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const entries = await Promise.all(
    RIVALRY.map(async (r): Promise<[string, TownLive | null]> => {
      try {
        const res = await fetch(`${base}/parties/drive/${r.slug}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
        if (!res.ok) return [r.slug, null];
        const json = (await res.json()) as Partial<TownLive>;
        if (typeof json.driving !== "number" || typeof json.watching !== "number") return [r.slug, null];
        return [r.slug, { driving: json.driving, watching: json.watching }];
      } catch {
        return [r.slug, null];
      }
    }),
  );
  return NextResponse.json(Object.fromEntries(entries), {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
  });
}
