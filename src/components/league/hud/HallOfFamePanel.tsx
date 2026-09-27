"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import type { LeaguePageData } from "@/lib/leagues/queries";
import { champions, gridWeeks, monumentWeeks, type Champion } from "@/lib/towns/hall";
import { townDisplayName } from "@/lib/towns/names";
import TrophyIcon from "@/components/towns/TrophyIcon";
import Panel from "./Panel";
import { ListDialog } from "./race";
import { Avatar, fmt } from "./shared";

/** Weeks and champion rows in the panel before "See all". */
const COLS = 12;
const ROWS = 5;
const ALL_COLS = 26;
const SQ = 12;
const EMPTY = "#26262c";

const shortDate = (week: string) =>
  new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Squares({ weeks, on, tone }: { weeks: string[]; on: (w: string) => boolean; tone: string }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {weeks.map((w) => (
        <span key={w} title={shortDate(w)} className="block shrink-0" style={{ width: SQ, height: SQ, background: on(w) ? tone : EMPTY }} />
      ))}
    </span>
  );
}

function Grid({ data, cols, rows }: { data: LeaguePageData; cols: number; rows: number }) {
  const hall = data.hall_of_fame;
  const weeks = gridWeeks(hall, cols);
  const crowned: Champion[] = champions(hall).slice(0, rows);
  const monuments = monumentWeeks(hall);
  const width = weeks.length * (SQ + 2) - 2;
  return (
    <>
      <div className="flex items-center gap-2 px-1.5 text-[8px] text-muted">
        <span className="min-w-0 flex-1">
          Last {weeks.length} week{weeks.length === 1 ? "" : "s"}
        </span>
        <span className="flex shrink-0 justify-between" style={{ width }}>
          <span>{weeks.length > 1 ? shortDate(weeks[0]) : ""}</span>
          <span className="text-cream">Now</span>
        </span>
        <span className="w-8" />
      </div>
      <ol className="mt-1 space-y-0.5">
        <li className="flex min-h-8 items-center gap-2 border-2 border-lime/50 bg-lime/5 px-1.5 py-1">
          <TrophyIcon size={12} className="text-lime" label="Weeks the town took the monument" />
          <span className="min-w-0 flex-1 truncate text-[10px] text-cream normal-case">{townDisplayName(data.league.name)}</span>
          <Squares weeks={weeks} on={(w) => monuments.has(w)} tone="#c8e64a" />
          <span className="w-8 text-right text-[10px] text-lime tabular-nums">{fmt(monuments.size)}</span>
        </li>
        {crowned.map((c) => (
          <li key={c.login} className="flex min-h-8 items-center gap-2 border-2 border-transparent px-1.5 py-1">
            <Avatar src={c.avatar_url} size={16} />
            <span className="min-w-0 flex-1 truncate text-[10px] text-cream normal-case">@{c.login}</span>
            <Squares weeks={weeks} on={(w) => c.weeks.has(w)} tone="#8aaa1a" />
            <span className="flex w-8 items-center justify-end gap-1 text-[10px] text-cream tabular-nums" aria-label={`${c.crowns} crowns`}>
              {c.crowns}
              <Crown size={10} strokeWidth={2.5} className="text-lime" aria-hidden />
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * The town's weeks as squares: its row shows the weeks it took the monument,
 * one row per crowned member shows the weeks they won.
 */
export default function HallOfFamePanel({ data, onClose }: { data: LeaguePageData; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const hall = data.hall_of_fame;
  const crowned = champions(hall);
  const leader = data.week.standings[0];

  return (
    <>
      <Panel title="Hall of fame" onClose={onClose}>
        {hall.length === 0 ? (
          <div className="border-2 border-dashed border-border px-3 py-4 text-center">
            <Crown size={20} strokeWidth={2.5} className="mx-auto text-dim" aria-hidden />
            <p className="mt-2 text-[10px] text-cream normal-case">No champion yet</p>
            <p className="mx-auto mt-1 max-w-[32ch] text-[9px] leading-relaxed text-muted normal-case">
              The first week closes Monday. Its top member gets the crown and a spot here.
            </p>
            {leader && leader.total > 0 && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-lime normal-case">
                <Avatar src={leader.avatar_url} size={14} />
                @{leader.login} leads now · {fmt(leader.total)}
              </p>
            )}
          </div>
        ) : (
          <>
            <Grid data={data} cols={COLS} rows={ROWS} />
            {(crowned.length > ROWS || hall.length > COLS) && (
              <button
                type="button"
                onClick={() => setAll(true)}
                className="btn-press mt-3 flex h-10 w-full items-center justify-center border-2 border-border text-[10px] text-cream transition-colors hover:border-muted"
              >
                See all {hall.length} weeks · {crowned.length} champion{crowned.length === 1 ? "" : "s"}
              </button>
            )}
          </>
        )}
      </Panel>
      {all && (
        <ListDialog label="Every week, every champion" title="Hall of fame" sub={`${hall.length} weeks`} onClose={() => setAll(false)}>
          <li className="list-none">
            <Grid data={data} cols={ALL_COLS} rows={crowned.length} />
          </li>
        </ListDialog>
      )}
    </>
  );
}
