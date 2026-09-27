"use client";

import { useState } from "react";
import type { LeaguePageData, TownRankingRow } from "@/lib/leagues/queries";
import { crewSummary, townsAround } from "@/lib/towns/race-view";
import { townDisplayName } from "@/lib/towns/names";
import Panel from "./Panel";
import { CrewRow, DayLetters, HowItWorks, Lane, ListDialog, Stakes, UnrankedLane, useToday } from "./race";
import { withLiveTown } from "./RaceWidget";

/**
 * This week, short: the stakes, the towns around yours as lanes and the
 * crew's top as a contribution grid. "See all" opens the full list here.
 */
export default function StandingsPanel({
  data,
  ranking,
  onHallOfFame,
  onClose,
}: {
  data: LeaguePageData;
  ranking: TownRankingRow[];
  onHallOfFame: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"towns" | "crew" | null>(null);
  const today = useToday();
  const { league, week, viewer } = data;
  const live = withLiveTown(ranking, data);
  const max = Math.max(live[0]?.per_dev ?? 0, week.town?.perDev ?? 0);
  const { rows, gapBefore } = townsAround(live, league.id);
  const ranked = live.some((r) => r.league_id === league.id);
  const viewerLogin = viewer?.status === "active" ? viewer.login : null;
  const crew = crewSummary(week.standings, viewerLogin);
  const coding = week.standings.length - crew.idle;
  const isMe = (login: string) => viewerLogin !== null && login.toLowerCase() === viewerLogin.toLowerCase();

  return (
    <>
      <Panel title="This week" onClose={onClose}>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <Stakes />
          <HowItWorks />
        </div>

        <h3 className="mt-5 text-[10px] text-muted">Towns · per dev</h3>
        <ol className="mt-2 space-y-1.5">
          {rows.flatMap((t) => [
            ...(gapBefore.has(t.league_id)
              ? [
                  <li key={`gap-${t.league_id}`} className="py-0.5 text-center text-[8px] text-dim" aria-hidden>
                    ···
                  </li>,
                ]
              : []),
            <Lane key={t.league_id} town={t} max={max} mine={t.league_id === league.id} />,
          ])}
          {!ranked && <UnrankedLane name={league.name} coding={coding} />}
        </ol>
        {live.length > rows.length && (
          <button
            type="button"
            onClick={() => setView("towns")}
            className="btn-press mt-2 flex h-10 w-full items-center justify-center border-2 border-border text-[10px] text-cream transition-colors hover:border-muted"
          >
            See all {live.length} towns
          </button>
        )}

        <div className="mt-5 flex items-center gap-2 px-2 text-[9px] text-muted">
          <span className="w-4" />
          <span className="min-w-0 flex-1">Crew</span>
          <DayLetters today={today} size={12} />
          <span className="w-9" />
        </div>
        <ol className="mt-1 space-y-0.5">
          {crew.top.map((s, i) => (
            <CrewRow key={s.developer_id} row={s} rank={i + 1} today={today} me={isMe(s.login)} />
          ))}
          {crew.you && (
            <>
              <li className="text-center text-[8px] leading-none text-dim" aria-hidden>
                ···
              </li>
              <CrewRow row={crew.you.row} rank={crew.you.rank} today={today} me />
            </>
          )}
          {week.standings.length === 0 && <li className="px-2 text-[10px] text-muted normal-case">Nobody has joined yet.</li>}
        </ol>
        {crew.rest > 0 && (
          <button
            type="button"
            onClick={() => setView("crew")}
            className="btn-press mt-2 flex h-10 w-full items-center justify-center gap-2 border-2 border-border text-[10px] text-cream transition-colors hover:border-muted"
          >
            See all {week.standings.length}
            {crew.idle > 0 && <span className="text-dim">· {crew.idle} not coding</span>}
          </button>
        )}

        <button
          type="button"
          onClick={onHallOfFame}
          className="mt-4 flex h-10 w-full items-center justify-center text-[10px] text-lime transition-colors hover:text-cream"
        >
          Hall of fame ›
        </button>
      </Panel>

      {view === "towns" && (
        <ListDialog label="Towns this week" title="Towns" sub={`${live.length} racing · per dev`} onClose={() => setView(null)} pinned={
          <ol>
            {ranked ? (
              <Lane town={live.find((r) => r.league_id === league.id)!} max={max} mine />
            ) : (
              <UnrankedLane name={league.name} coding={coding} />
            )}
          </ol>
        }>
          {live.map((t) => (
            <Lane key={t.league_id} town={t} max={max} mine={t.league_id === league.id} />
          ))}
        </ListDialog>
      )}

      {view === "crew" && (
        <ListDialog
          label={`${townDisplayName(league.name)} crew this week`}
          title={townDisplayName(league.name)}
          sub={`${week.standings.length} members`}
          onClose={() => setView(null)}
          header={
            <div className="flex items-center gap-2 border-b-2 border-border px-5 py-2 text-[9px] text-muted">
              <span className="w-4" />
              <span className="min-w-0 flex-1">This week</span>
              <DayLetters today={today} size={16} />
              <span className="w-9" />
            </div>
          }
          pinned={(() => {
            const i = viewerLogin ? week.standings.findIndex((s) => isMe(s.login)) : -1;
            return i >= 0 ? (
              <ol>
                <CrewRow row={week.standings[i]} rank={i + 1} today={today} me size={16} />
              </ol>
            ) : undefined;
          })()}
        >
          {week.standings.map((s, i) => (
            <CrewRow key={s.developer_id} row={s} rank={i + 1} today={today} me={isMe(s.login)} size={16} />
          ))}
        </ListDialog>
      )}
    </>
  );
}
