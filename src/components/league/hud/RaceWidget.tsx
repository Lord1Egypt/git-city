"use client";

import type { LeaguePageData } from "@/lib/leagues/queries";
import { DAILY_CONTRIBUTION_CAP } from "@/lib/leagues/scoring";
import { placeLine, type TownPlace } from "@/lib/towns/place";
import { Avatar, HUD_BOX, fmt, useCountdown } from "./shared";

export default function RaceWidget({
  data,
  place = null,
  townOfWeek = false,
  onHallOfFame,
  onStandings,
}: {
  data: LeaguePageData;
  /** This week's place among towns. */
  place?: TownPlace | null;
  /** The town holds the monument this week. */
  townOfWeek?: boolean;
  onHallOfFame: () => void;
  onStandings: () => void;
}) {
  const { week, viewer } = data;
  const countdown = useCountdown();
  const top = week.standings.slice(0, 5);
  const mine = viewer ? week.standings.find((s) => s.login === viewer.login) : undefined;
  const showMine = mine && mine.rank > 5;

  return (
    <section className={`${HUD_BOX} w-[260px] px-3 py-3 sm:w-[280px]`}>
      <div className="flex items-baseline justify-between text-[9px]">
        <span className="text-cream">This week</span>
        <span className="text-muted">Ends in {countdown || "…"}</span>
      </div>
      {(townOfWeek || place) && (
        <div className="mt-2 space-y-1 border-2 border-lime/60 bg-lime/10 px-2 py-1.5 text-[9px] normal-case">
          {townOfWeek && <p className="text-lime">&#127942; Town of the week</p>}
          {place && <p className={townOfWeek ? "text-cream" : "text-lime"}>{placeLine(place)}</p>}
        </div>
      )}
      <button type="button" onClick={onStandings} className="mt-2 block w-full text-left" aria-label="Full standings">
        <ol className="space-y-1">
          {top.map((s) => (
            <Row key={s.developer_id} rank={s.rank} login={s.login} avatar={s.avatar_url} total={s.total} me={viewer?.login === s.login} />
          ))}
          {showMine && (
            <>
              <li className="text-center text-[8px] leading-none text-dim">···</li>
              <Row rank={mine.rank} login={mine.login} avatar={mine.avatar_url} total={mine.total} me />
            </>
          )}
          {top.length === 0 && <li className="py-1 text-[10px] text-muted normal-case">Nobody has joined yet.</li>}
        </ol>
      </button>
      <div className="mt-2.5 flex justify-between border-t-2 border-border pt-2 text-[9px]">
        <button type="button" onClick={onStandings} className="text-muted transition-colors hover:text-cream">
          Contributions · max {DAILY_CONTRIBUTION_CAP}/day
        </button>
        <button type="button" onClick={onHallOfFame} className="text-lime transition-colors hover:text-cream">
          Hall of fame ›
        </button>
      </div>
    </section>
  );
}

function Row({ rank, login, avatar, total, me }: { rank: number; login: string; avatar: string | null; total: number; me: boolean }) {
  return (
    <li className={`flex items-center gap-2 px-1 py-0.5 ${me ? "bg-lime/10" : ""}`}>
      <span className={`w-4 text-right text-[10px] ${rank === 1 ? "text-lime" : "text-muted"}`}>{rank}</span>
      <Avatar src={avatar} size={18} />
      <span className={`min-w-0 flex-1 truncate text-[10px] normal-case ${me ? "text-lime" : "text-cream"}`}>@{login}</span>
      <span className="text-[10px] text-cream tabular-nums">{fmt(total)}</span>
    </li>
  );
}
