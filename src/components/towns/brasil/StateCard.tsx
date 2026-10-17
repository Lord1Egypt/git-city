"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import type { CityBuilding } from "@/lib/github";
import { Avatar, fmt } from "@/components/league/hud/shared";
import { useSheet } from "@/components/league/hud/useSheet";
import TrophyIcon from "@/components/towns/TrophyIcon";
import { swatchOf, type StateStats, type WeekStanding } from "./stats";

// A state's card, opened from its tag or a search: its founder, how many
// devs live there and its place among the 27, its top five devs (each one a
// click away), and the two ways to grow it: drive there, or invite someone
// with the link and what to comment on the reel.

export default function StateCard({
  state: s,
  byLogin,
  townPath,
  onPickDev,
  onDriveHere,
  onClose,
  week,
}: {
  state: StateStats;
  byLogin: ReadonlyMap<string, CityBuilding>;
  /** The town's path, for the invite link. */
  townPath: string;
  onPickDev: (login: string) => void;
  onDriveHere?: () => void;
  onClose: () => void;
  /** Last full week's crown and this week's leader, when either is this state. */
  week?: { crown: WeekStanding | null; leading: WeekStanding | null };
}) {
  const sheet = useSheet(onClose);
  const { close } = sheet;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const invite = () => {
    const url = `${window.location.origin}${townPath}?uf=${s.uf}`;
    // Shared by Brazilians to Brazilians: Portuguese, one line, a nudge for the state.
    const text = s.devs === 0 ? `${s.name} ainda não tem ninguém no mapa dos devs. Bora fundar? ${url}` : `${s.name} tá em #${s.place} no mapa dos devs. Bora subir? ${url}`;
    posthog.capture("brasil_invite_copied", { uf: s.uf, from: "state_card" });
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const founder = s.founder ? byLogin.get(s.founder.toLowerCase()) : null;

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2">
      <div
        role="dialog"
        aria-label={s.name}
        className={`${sheet.className} relative max-h-[60vh] w-full overflow-y-auto border-t-[3px] border-border bg-bg-raised/95 font-pixel uppercase text-warm backdrop-blur-sm sm:max-h-[85vh] sm:w-[340px] sm:border-[3px]`}
      >
        <button type="button" onClick={close} className="absolute right-3 top-2 z-10 text-[10px] text-muted transition-colors hover:text-cream">
          ESC
        </button>

        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="h-9 w-9 shrink-0 border-2 border-border-light" style={{ background: swatchOf(s.uf) }} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-cream">{s.name}</p>
            <p className="text-[9px] normal-case text-muted">
              {s.uf} · {s.capital.name}
              {s.second ? ` and ${s.second.name}` : ""}
            </p>
          </div>
        </div>

        {week?.crown?.uf === s.uf && (
          <div className="mx-4 mb-3 flex items-center gap-2.5 border-2 border-lime px-3 py-2">
            <TrophyIcon size={14} className="text-lime" />
            <div>
              <p className="text-[10px] text-lime">State of the week</p>
              <p className="text-[9px] normal-case text-muted">+{fmt(week.crown.gained)} devs last week, the most of any state</p>
            </div>
          </div>
        )}
        {week?.leading?.uf === s.uf && week.crown?.uf !== s.uf && (
          <p className="mx-4 mb-3 text-[9px] normal-case text-lime">Leading this week: +{fmt(week.leading.gained)} devs. The crown goes out on Monday.</p>
        )}
        <div className="mx-4 mb-3 flex items-center gap-3 border-2 border-border px-3 py-2">
          {s.founder ? (
            <>
              <Avatar src={founder?.avatar_url ?? null} size={28} />
              <button type="button" onClick={() => onPickDev(s.founder!)} className="min-w-0 text-left">
                <span className="block text-[8px] text-lime">Founder</span>
                <span className="block truncate text-[10px] normal-case text-cream hover:text-lime">@{s.founder}</span>
              </button>
            </>
          ) : (
            <p className="text-[9px] normal-case text-muted">No founder yet. The first dev here founds {s.name}.</p>
          )}
        </div>

        <div className="mx-4 mb-3 grid grid-cols-3 gap-px border border-border/50 bg-border/30">
          {[
            { label: "Devs", value: fmt(s.devs) },
            { label: "Place", value: s.devs > 0 ? `#${s.place}` : "–" },
            { label: "This week", value: `+${fmt(s.newThisWeek)}` },
          ].map((x) => (
            <div key={x.label} className="bg-bg-card p-2 text-center">
              <div className="text-xs text-lime">{x.value}</div>
              <div className="mt-0.5 text-[8px] text-muted">{x.label}</div>
            </div>
          ))}
        </div>

        {s.top.length > 0 && (
          <div className="mx-4 mb-3">
            <p className="mb-1.5 text-[8px] text-muted">Top devs · {fmt(s.contributions)} contributions</p>
            <ol className="flex flex-col">
              {s.top.map((login, i) => {
                const b = byLogin.get(login.toLowerCase());
                return (
                  <li key={login}>
                    <button type="button" onClick={() => onPickDev(login)} className="flex w-full items-center gap-2.5 py-1 text-left hover:text-lime">
                      <span className="w-3 text-[9px] text-muted">{i + 1}</span>
                      <Avatar src={b?.avatar_url ?? null} size={20} />
                      <span className="min-w-0 flex-1 truncate text-[10px] normal-case text-cream">@{login}</span>
                      <span className="text-[9px] text-muted">{fmt(b?.contributions ?? 0)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mx-4 mb-4 flex flex-col gap-1.5">
          {onDriveHere && (
            <button type="button" onClick={onDriveHere} className="btn-press w-full border-2 border-lime bg-lime py-2 text-[10px] text-bg">
              Drive to {s.capital.name}
            </button>
          )}
          <button type="button" onClick={invite} className="btn-press w-full border-2 border-border py-2 text-[10px] text-cream hover:border-lime hover:text-lime">
            {copied ? "Invite copied" : `Invite to ${s.uf}`}
          </button>
        </div>
      </div>
    </div>
  );
}
