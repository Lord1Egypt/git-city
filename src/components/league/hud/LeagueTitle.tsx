"use client";

import Link from "next/link";
import { BadgeCheck, ChevronLeft } from "lucide-react";
import type { LeaguePageData } from "@/lib/leagues/queries";
import { TOWN_MIN_CODERS } from "@/lib/leagues/scoring";
import { townDisplayName } from "@/lib/towns/names";
import type { TownBadges } from "@/lib/towns/milestones";
import { ordinal, type TownPlace } from "@/lib/towns/place";
import { RIVALRY } from "@/lib/towns/rivalry";
import TrophyIcon from "@/components/towns/TrophyIcon";
import { HUD_BOX, fmt } from "./shared";

const flag = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** What kind of town it is, in one short line. */
function KindLine({ league }: { league: LeaguePageData["league"] }) {
  const side = RIVALRY.find((r) => r.slug === league.slug);
  if (side) {
    const rival = RIVALRY.find((r) => r.slug !== league.slug);
    return (
      <span className="normal-case" style={{ color: side.color }}>
        {side.name} side{rival ? ` · vs ${rival.name}` : ""}
      </span>
    );
  }
  if (league.kind === "company")
    return (
      <span className="flex items-center gap-1 text-lime normal-case">
        <BadgeCheck size={11} strokeWidth={2.5} aria-label="Verified" />@{league.github_org}
      </span>
    );
  if (league.country) return <span className="text-muted normal-case">{flag(league.country)} Country town</span>;
  return <span className="text-muted">Group town</span>;
}

/**
 * The town's card, top left: who it is, then three numbers for how it's doing
 * this week (place among towns, per dev, members coding).
 */
export default function LeagueTitle({
  data,
  badges,
  logoUrl,
  place,
  pendingRequests = 0,
}: {
  data: LeaguePageData;
  badges: TownBadges;
  logoUrl: string | null;
  /** This week's place among towns (null for hidden towns or a failed read). */
  place: TownPlace | null;
  /** Admin only: open join requests, with a link to answer them. */
  pendingRequests?: number;
}) {
  const { league, counts, week } = data;
  const coders = week.standings.filter((s) => s.total > 0);
  const perDev = week.town?.perDev ?? (coders.length ? Math.round(coders.reduce((a, s) => a + s.total, 0) / coders.length) : 0);
  const stats: { label: string; value: string; lit?: boolean }[] = [
    place?.rank
      ? { label: "This week", value: `${ordinal(place.rank)}/${place.total}`, lit: place.rank === 1 }
      : { label: "To race", value: `${Math.min(coders.length, TOWN_MIN_CODERS)}/${TOWN_MIN_CODERS}` },
    { label: "Per dev", value: fmt(perDev) },
    { label: "Coding", value: `${fmt(coders.length)}/${fmt(counts.joined)}` },
  ];

  return (
    <div className={`${HUD_BOX} pointer-events-auto w-[340px] max-w-[calc(100vw-2rem)]`}>
      <div className="flex items-center gap-3 px-3.5 pb-3 pt-2.5">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 [image-rendering:pixelated]" />
        )}
        <div className="min-w-0 flex-1">
          <Link href="/towns" className="-ml-1 inline-flex items-center gap-0.5 py-0.5 text-[9px] text-muted transition-colors hover:text-cream">
            <ChevronLeft size={12} strokeWidth={2.5} aria-hidden />
            Towns
          </Link>
          <h1 className="truncate text-lg leading-tight text-cream normal-case">{townDisplayName(league.name)}</h1>
          <p className="mt-1 flex items-center gap-2 text-[9px]">
            <KindLine league={league} />
          </p>
        </div>
      </div>

      {badges.townOfWeek && (
        <p className="flex items-center gap-1.5 border-t-2 border-border bg-lime px-3.5 py-1.5 text-[9px] text-bg">
          <TrophyIcon size={10} /> Town of the week
        </p>
      )}

      <dl className="grid grid-cols-3 divide-x-2 divide-border border-t-2 border-border">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse px-2 py-2 text-center">
            <dt className="mt-0.5 text-[8px] text-muted">{s.label}</dt>
            <dd className={`text-sm tabular-nums ${s.lit ? "text-lime" : "text-cream"}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      {pendingRequests > 0 && (
        <Link
          href={`/town/${league.slug}/settings#requests`}
          className="flex items-center justify-between gap-3 border-t-2 border-border bg-lime/10 px-3.5 py-2 text-[10px] text-lime transition-colors hover:bg-lime hover:text-bg"
        >
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse bg-lime" aria-hidden />
            {pendingRequests} join request{pendingRequests === 1 ? "" : "s"}
          </span>
          <span>Review &rarr;</span>
        </Link>
      )}
    </div>
  );
}
