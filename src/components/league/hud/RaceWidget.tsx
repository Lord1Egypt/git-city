"use client";

import { Crown } from "lucide-react";
import type { LeaguePageData, TownRankingRow } from "@/lib/leagues/queries";
import { TOWN_MIN_CODERS } from "@/lib/leagues/scoring";
import { townsAround } from "@/lib/towns/race-view";
import { Avatar, HUD_BOX, fmt } from "./shared";
import { DaySquares, Stakes, TownDaysRow, useToday } from "./race";

/**
 * Your town's row with this page's live numbers: the ranking is cached for a
 * few minutes, the board for one, so the town you're looking at never lags.
 */
export function withLiveTown(ranking: TownRankingRow[], data: LeaguePageData): TownRankingRow[] {
  const { week, league } = data;
  return ranking.map((r) =>
    r.league_id === league.id && week.town ? { ...r, per_dev: week.town.perDev, coding: week.town.coding, days: week.days } : r,
  );
}

/** Top right on desktop: the race around your town as a contribution graph, and your own week. */
export default function RaceWidget({
  data,
  ranking,
  onOpen,
}: {
  data: LeaguePageData;
  ranking: TownRankingRow[];
  onOpen: () => void;
}) {
  const today = useToday();
  const { league, week, viewer } = data;
  const live = withLiveTown(ranking, data);
  const { rows, gapBefore } = townsAround(live, league.id);
  const ranked = live.some((r) => r.league_id === league.id);
  const coders = week.standings.filter((s) => s.total > 0);
  const coding = coders.length;
  const perDev = coding ? Math.round(coders.reduce((a, s) => a + s.total, 0) / coding) : 0;
  const you = viewer ? week.standings.find((s) => s.login === viewer.login && viewer.status === "active") : undefined;
  const leader = week.standings[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open this week's race"
      className={`${HUD_BOX} btn-press block w-[300px] px-3 py-3 text-left`}
    >
      <Stakes small />
      <ol className="mt-2.5 space-y-0.5">
        {rows.flatMap((t) => [
          ...(gapBefore.has(t.league_id)
            ? [
                <li key={`gap-${t.league_id}`} className="text-center text-[8px] leading-none text-dim" aria-hidden>
                  ···
                </li>,
              ]
            : []),
          <TownDaysRow key={t.league_id} town={t} today={today} mine={t.league_id === league.id} />,
        ])}
        {!ranked && <TownDaysRow town={{ rank: null, name: league.name, days: week.days, per_dev: perDev }} today={today} mine />}
      </ol>
      {!ranked && <p className="mt-1 px-1 text-[8px] text-lime normal-case">{coding} of {TOWN_MIN_CODERS} coding to race</p>}
      {you && (
        <div className="mt-2 flex items-center gap-2 border-t-2 border-border px-1 pt-2 text-[9px]">
          <Avatar src={you.avatar_url} size={14} />
          <span className="min-w-0 flex-1 truncate text-cream">You</span>
          <DaySquares days={you.days} today={today} size={10} />
          <span className="w-8 shrink-0 text-right text-cream tabular-nums">{fmt(you.total)}</span>
        </div>
      )}
      {leader && leader.total > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[9px] text-muted normal-case">
          <Crown size={11} strokeWidth={2.5} className="shrink-0 text-lime" aria-hidden />
          <span className="truncate">
            @{leader.login} leads the crew · {fmt(leader.total)}
          </span>
        </p>
      )}
      {week.standings.length === 0 && <p className="mt-2 px-1 text-[9px] text-muted normal-case">Nobody has joined yet.</p>}
    </button>
  );
}
