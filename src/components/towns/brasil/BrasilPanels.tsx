"use client";

import { useMemo, useState } from "react";
import type { CityBuilding } from "@/lib/github";
import Panel from "@/components/league/hud/Panel";
import { Avatar, fmt } from "@/components/league/hud/shared";
import { STATES, type CityLayout, type UF } from "@/lib/towns/brasil-map";
import { swatchOf, type StateStats } from "./stats";

// The Brasil town's side panels, in the towns' Panel: search the map (a
// state, a city, a dev), the 27 states ranked, and picking your state.

const MAX = 30;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Search by state (name or UF), city (capital or second city) or GitHub username. */
export function BrasilSearch({
  cities,
  island,
  buildings,
  onPickCity,
  onPickBuilding,
  onClose,
}: {
  cities: CityLayout[];
  island: CityLayout;
  buildings: CityBuilding[];
  onPickCity: (c: CityLayout) => void;
  onPickBuilding: (b: CityBuilding) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = fold(query.trim().replace(/^@/, ""));
  const places = useMemo(() => {
    const all = [...cities, island];
    if (!q) return [];
    return all.filter((c) => {
      const st = c.uf ? STATES.find((s) => s.uf === c.uf) : null;
      return fold(c.name).includes(q) || (st && (fold(st.name).includes(q) || st.uf.toLowerCase() === q)) || (!c.uf && "island".startsWith(q));
    });
  }, [cities, island, q]);
  const devs = useMemo(() => {
    if (!q) return [...buildings].sort((a, b) => (b.contributions ?? 0) - (a.contributions ?? 0)).slice(0, MAX);
    const starts = buildings.filter((b) => b.loginLower.startsWith(q));
    const contains = buildings.filter((b) => !b.loginLower.startsWith(q) && b.loginLower.includes(q));
    return [...starts, ...contains].slice(0, MAX);
  }, [buildings, q]);

  return (
    <Panel title="Search the map" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (places[0]) onPickCity(places[0]);
          else if (devs[0]) onPickBuilding(devs[0]);
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="State, city or GitHub username"
          aria-label="State, city or GitHub username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full border-2 border-border bg-bg px-3 py-2 text-base normal-case text-cream outline-none placeholder:text-dim focus:border-lime/60 sm:text-[11px]"
        />
      </form>
      <div className="mt-3 flex min-h-0 flex-col gap-3 overflow-y-auto">
        {places.length > 0 && (
          <ul className="flex flex-col">
            {places.map((c) => (
              <li key={`${c.uf ?? "island"}-${c.second ? 2 : 1}`}>
                <button type="button" onClick={() => onPickCity(c)} className="flex w-full items-center gap-2.5 px-1 py-1.5 text-left hover:text-lime">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ background: c.uf ? swatchOf(c.uf) : "#c8e64a" }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[11px] normal-case text-cream">{c.name}</span>
                  <span className="text-[9px] text-muted">
                    {c.uf ?? "Island"} · {fmt(c.devs.length)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {devs.length === 0 && places.length === 0 ? (
          <p className="text-[10px] normal-case text-muted">Nothing on the map called “{query.trim()}”.</p>
        ) : (
          <ul className="flex flex-col">
            {devs.map((b) => (
              <li key={b.loginLower}>
                <button type="button" onClick={() => onPickBuilding(b)} className="flex w-full items-center gap-2.5 px-1 py-1.5 text-left hover:text-lime">
                  <Avatar src={b.avatar_url ?? null} size={20} />
                  <span className="min-w-0 flex-1 truncate text-[11px] normal-case text-cream">@{b.login}</span>
                  <span className="text-[9px] text-muted">{fmt(b.contributions ?? 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** The 27 states by devs, your state picked out. */
export function BrasilRanking({ states, yours, onPick, onClose }: { states: StateStats[]; yours: UF | null; onPick: (s: StateStats) => void; onClose: () => void }) {
  return (
    <Panel title="States" onClose={onClose}>
      <ol className="flex min-h-0 flex-col overflow-y-auto">
        {states.map((s) => (
          <li key={s.uf}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left ${s.uf === yours ? "bg-lime text-bg" : "text-cream hover:text-lime"}`}
            >
              <span className={`w-6 text-[9px] ${s.uf === yours ? "" : "text-muted"}`}>{s.devs > 0 ? s.place : "–"}</span>
              <span className="h-2.5 w-2.5 shrink-0" style={{ background: swatchOf(s.uf) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[10px] normal-case">{s.name}</span>
              <span className="text-[10px]">{fmt(s.devs)}</span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Pick your state (or none: the island). Moving gives you a new lot in the new state. */
export function BrasilJoin({
  signedIn,
  current,
  busy,
  error,
  onPick,
  onSignIn,
  onClose,
}: {
  signedIn: boolean;
  /** Where you live now: a state, "island", or null when you're not on the map. */
  current: UF | "island" | null;
  busy: boolean;
  error: string | null;
  onPick: (uf: UF | null) => void;
  onSignIn: () => void;
  onClose: () => void;
}) {
  return (
    <Panel title={current ? "Your state" : "Join the map"} onClose={onClose}>
      {!signedIn ? (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] normal-case text-muted">Sign in with GitHub, pick your state, and your building goes up in its city.</p>
          <button type="button" onClick={onSignIn} className="btn-press border-2 border-lime bg-lime py-2 text-[11px] text-bg">
            Sign in with GitHub
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-3">
          <p className="text-[10px] normal-case text-muted">
            {current
              ? "Moving to another state gives you a new lot there. You can move once a week."
              : "Your building goes up in your state's city. The first dev in a state is its founder."}
          </p>
          <div className="grid grid-cols-3 gap-1 overflow-y-auto">
            {STATES.map((s) => (
              <button
                key={s.uf}
                type="button"
                disabled={busy || current === s.uf}
                onClick={() => onPick(s.uf)}
                className={`flex items-center gap-1.5 border-2 px-2 py-1.5 text-left text-[10px] ${current === s.uf ? "border-lime text-lime" : "border-border text-cream hover:border-lime/60"} disabled:cursor-default`}
              >
                <span className="h-2 w-2 shrink-0" style={{ background: swatchOf(s.uf) }} aria-hidden />
                {s.uf}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || current === "island"}
            onClick={() => onPick(null)}
            className={`border-2 py-1.5 text-[10px] ${current === "island" ? "border-lime text-lime" : "border-border text-muted hover:text-cream"}`}
          >
            No state · live on the island
          </button>
          {error && <p className="text-[9px] normal-case text-red-400">{error}</p>}
        </div>
      )}
    </Panel>
  );
}
