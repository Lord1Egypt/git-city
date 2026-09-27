"use client";

// Shared pieces of the town race HUD (widget, panel, "See all" dialogs):
// GitHub-style day squares, town lanes, crew rows and the list window.
import { useEffect, useState, type ReactNode } from "react";
import { CircleHelp, Crown, X } from "lucide-react";
import TrophyIcon from "@/components/towns/TrophyIcon";
import type { LeagueStandingEntry } from "@/lib/leagues/standings";
import type { TownRankingRow } from "@/lib/leagues/queries";
import { DAILY_CONTRIBUTION_CAP, TOWN_MIN_CODERS } from "@/lib/leagues/scoring";
import { DAY_COLORS, DAY_LETTERS, dayIndex, dayLevel } from "@/lib/towns/race-view";
import { townDisplayName } from "@/lib/towns/names";
import { Avatar, HUD_BOX, fmt, useCountdown } from "./shared";

/** Today's column (UTC), read once on the client. */
export function useToday(): number {
  const [today, setToday] = useState(() => dayIndex(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday(dayIndex(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export function DaySquares({ days, today, size, label }: { days: number[]; today: number; size: number; label?: string }) {
  return (
    <span className="flex shrink-0 gap-0.5" role={label ? "img" : undefined} aria-label={label}>
      {days.map((n, d) => {
        const future = d > today;
        return (
          <span
            key={d}
            title={future ? undefined : fmt(n)}
            className={`block shrink-0 ${future ? "border border-dashed border-border" : ""} ${d === today ? "outline outline-1 outline-offset-1 outline-cream/60" : ""}`}
            style={{ width: size, height: size, background: future ? "transparent" : DAY_COLORS[dayLevel(n)] }}
          />
        );
      })}
    </span>
  );
}

export function DayLetters({ today, size }: { today: number; size: number }) {
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden>
      {DAY_LETTERS.map((l, i) => (
        <span key={i} className={`text-center ${i === today ? "text-cream" : "text-dim"}`} style={{ width: size }}>
          {l}
        </span>
      ))}
    </span>
  );
}

/** "#1 takes the monument · 21h 38m". */
export function Stakes({ small = false }: { small?: boolean }) {
  const left = useCountdown();
  return (
    <span className={`flex items-center gap-1.5 text-cream ${small ? "text-[9px]" : "text-[10px]"}`}>
      <TrophyIcon size={12} className="text-lime" />
      #1 takes the monument · <span className="tabular-nums">{left || "…"}</span>
    </span>
  );
}

/** A town racing: its bar is its per dev against the leader's. */
export function Lane({ town, max, mine }: { town: TownRankingRow; max: number; mine: boolean }) {
  const w = Math.max(4, Math.round((town.per_dev / Math.max(max, 1)) * 100));
  return (
    <li className="flex items-center gap-2 text-[10px]">
      <span className={`w-5 shrink-0 text-right tabular-nums ${mine ? "text-lime" : "text-muted"}`}>{town.rank}</span>
      <div className={`relative h-7 min-w-0 flex-1 border-2 ${mine ? "border-lime/70 bg-lime/10" : "border-border bg-bg-card"}`}>
        <div className={`h-full ${mine ? "bg-lime/35" : "bg-white/10"}`} style={{ width: `${w}%` }} />
        <span className={`absolute inset-x-2 inset-y-0 block truncate leading-6 normal-case ${mine ? "text-cream" : "text-warm"}`}>
          {townDisplayName(town.name)}
        </span>
      </div>
      <span className={`w-12 shrink-0 text-right tabular-nums ${mine ? "text-lime" : "text-cream"}`}>{fmt(town.per_dev)}</span>
    </li>
  );
}

/** Your town before it races: a dashed lane with "2/3" coding. */
export function UnrankedLane({ name, coding }: { name: string; coding: number }) {
  return (
    <li className="flex items-center gap-2 text-[10px]">
      <span className="w-5 shrink-0 text-right text-lime">–</span>
      <div className="flex h-7 min-w-0 flex-1 items-center border-2 border-dashed border-lime/60 px-2">
        <span className="truncate text-cream normal-case">{townDisplayName(name)}</span>
      </div>
      <span className="w-12 shrink-0 text-right text-lime tabular-nums" aria-label={`${coding} of ${TOWN_MIN_CODERS} coding`}>
        {coding}/{TOWN_MIN_CODERS}
      </span>
    </li>
  );
}

/** A member's week: rank, avatar, login, crown, day squares, total. */
export function CrewRow({
  row,
  rank,
  today,
  me,
  size = 12,
}: {
  row: LeagueStandingEntry;
  rank: number;
  today: number;
  me: boolean;
  size?: number;
}) {
  const idle = row.total === 0;
  const crowned = rank === 1 && !idle;
  return (
    <li className={`flex min-h-8 items-center gap-2 border-2 px-1.5 py-1 ${me ? "border-lime bg-lime/5" : "border-transparent"} ${idle ? "opacity-50" : ""}`}>
      <span className={`w-4 shrink-0 text-right text-[9px] tabular-nums ${crowned ? "text-lime" : "text-muted"}`}>{idle ? "–" : rank}</span>
      <Avatar src={row.avatar_url} size={18} faded={idle} />
      <span className={`flex min-w-0 flex-1 items-center gap-1 text-[10px] normal-case ${idle ? "text-dim" : "text-cream"}`}>
        <span className="truncate">@{row.login}</span>
        {crowned && <Crown size={11} strokeWidth={2.5} className="shrink-0 text-lime" aria-label="Wears the crown" />}
      </span>
      <DaySquares days={row.days} today={today} size={size} label={`@${row.login}: ${fmt(row.total)} contributions this week`} />
      <span className={`w-9 text-right text-[10px] tabular-nums ${idle ? "text-dim" : "text-cream"}`}>{fmt(row.total)}</span>
    </li>
  );
}

/** The rules, one tap away instead of on screen. */
export function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="How it works"
        className="-m-2 flex h-8 w-8 shrink-0 items-center justify-center text-muted transition-colors hover:text-cream"
      >
        <CircleHelp size={14} strokeWidth={2.5} aria-hidden />
      </button>
      {open && (
        <p className="col-span-2 border-2 border-border bg-bg-card px-3 py-2 text-[9px] leading-relaxed text-warm normal-case">
          Towns score the average GitHub contributions of members coding (max {DAILY_CONTRIBUTION_CAP}/day, {TOWN_MIN_CODERS}+ to race). #1 on Monday
          takes the monument. The top member wears the crown.
        </p>
      )}
    </>
  );
}

/** A window over the city for a full list; Esc, the backdrop or × close it. */
export function ListDialog({
  label,
  title,
  sub,
  header,
  pinned,
  onClose,
  children,
}: {
  label: string;
  title: string;
  sub: string;
  header?: ReactNode;
  pinned?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    // Capture first, so Esc closes this window and not the panel under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`${HUD_BOX} flex max-h-[88vh] w-full flex-col bg-bg/95 font-pixel uppercase text-warm sm:max-w-[560px]`}
      >
        <header className="flex items-center justify-between border-b-2 border-border px-4 py-3">
          <h2 className="min-w-0 truncate text-sm text-cream normal-case">
            {title} <span className="text-muted">· {sub}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="btn-press -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center text-muted transition-colors hover:text-cream"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </header>
        {header}
        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">{children}</ol>
        {pinned && <footer className="border-t-2 border-border px-3 py-2">{pinned}</footer>}
      </section>
    </div>
  );
}

/** A town's row in the widget: rank, name, its day squares, per dev. */
export function TownDaysRow({ town, today, mine }: { town: { rank: number | null; name: string; days: number[]; per_dev: number }; today: number; mine: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 px-1 py-0.5 text-[9px] ${mine ? "bg-lime/10" : ""} ${town.rank === null ? "border border-dashed border-lime/50" : ""}`}
    >
      <span className={`w-4 shrink-0 text-right tabular-nums ${mine ? "text-lime" : "text-muted"}`}>{town.rank ?? "–"}</span>
      <span className={`min-w-0 flex-1 truncate normal-case ${mine ? "text-cream" : "text-warm"}`}>{townDisplayName(town.name)}</span>
      <DaySquares days={town.days} today={today} size={10} />
      <span className={`w-8 shrink-0 text-right tabular-nums ${mine ? "text-lime" : "text-cream"}`}>{fmt(town.per_dev)}</span>
    </li>
  );
}
