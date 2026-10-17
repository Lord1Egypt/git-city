"use client";

import { useMemo, useState } from "react";
import type { CityBuilding } from "@/lib/github";
import Panel from "@/components/league/hud/Panel";
import { Avatar, fmt } from "@/components/league/hud/shared";
import { STATES, type CityLayout, type UF } from "@/lib/towns/brasil-map";
import { swatchOf, type StateStats } from "./stats";

// The Brasil town's side panels, in the towns' Panel: search the map (a
// state, a city, a dev), the 27 states ranked, and picking your state.

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,38})$/;

/**
 * The search over the map, always there: a state (name or UF), a city
 * (capital or second city) or a GitHub username. A username that isn't on
 * the map yet gets the way to put it there.
 */
export function BrasilSearchBar({
  cities,
  island,
  buildings,
  onPickCity,
  onPickBuilding,
  onPutOnMap,
}: {
  cities: CityLayout[];
  island: CityLayout;
  buildings: CityBuilding[];
  onPickCity: (c: CityLayout) => void;
  onPickBuilding: (b: CityBuilding) => void;
  /** Someone typed a username that isn't on the map. */
  onPutOnMap: (login: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = fold(query.trim().replace(/^@/, ""));
  const places = useMemo(() => {
    if (!q) return [];
    return [...cities, island]
      .filter((c) => {
        const st = c.uf ? STATES.find((s) => s.uf === c.uf) : null;
        return fold(c.name).includes(q) || (st && (fold(st.name).includes(q) || st.uf.toLowerCase() === q)) || (!c.uf && "island".startsWith(q));
      })
      .slice(0, 5);
  }, [cities, island, q]);
  const devs = useMemo(() => {
    if (!q) return [];
    const starts = buildings.filter((b) => b.loginLower.startsWith(q));
    const contains = buildings.filter((b) => !b.loginLower.startsWith(q) && b.loginLower.includes(q));
    return [...starts, ...contains].slice(0, 6);
  }, [buildings, q]);
  const missing = LOGIN.test(q) && !buildings.some((b) => b.loginLower === q) ? q : null;
  const pick = (f: () => void) => {
    f();
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="pointer-events-auto relative w-[min(420px,calc(100vw-32px))] font-pixel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const exact = devs.find((b) => b.loginLower === q);
          if (exact) pick(() => onPickBuilding(exact));
          else if (places[0]) pick(() => onPickCity(places[0]));
          else if (devs[0]) pick(() => onPickBuilding(devs[0]));
          else if (missing) pick(() => onPutOnMap(missing));
        }}
        className="flex items-stretch shadow-[0_6px_0_rgba(0,0,0,0.35)]"
      >
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), setOpen(false))}
          placeholder="Your @username, a city or a state"
          aria-label="Find your building: GitHub username, city or state"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="min-w-0 flex-1 border-[3px] border-border bg-bg/90 px-3 py-2 text-base normal-case text-cream outline-none backdrop-blur-sm placeholder:text-dim focus:border-lime/70 sm:text-[12px]"
        />
        <button type="submit" className="bg-lime px-4 text-[11px] uppercase text-bg">
          Find
        </button>
      </form>
      {open && q && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 flex max-h-[50vh] flex-col overflow-y-auto border-[3px] border-border bg-bg/95 uppercase backdrop-blur-sm">
          {places.map((c) => (
            <button key={`${c.uf ?? "island"}-${c.second ? 2 : 1}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(() => onPickCity(c))} className="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#141417]">
              <span className="h-2.5 w-2.5 shrink-0" style={{ background: c.uf ? swatchOf(c.uf) : "#c8e64a" }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[11px] normal-case text-cream">{c.name}</span>
              <span className="text-[9px] text-muted">
                {c.uf ?? "Island"} · {fmt(c.devs.length)}
              </span>
            </button>
          ))}
          {devs.map((b) => (
            <button key={b.loginLower} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(() => onPickBuilding(b))} className="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#141417]">
              <Avatar src={b.avatar_url ?? null} size={20} />
              <span className="min-w-0 flex-1 truncate text-[11px] normal-case text-cream">@{b.login}</span>
              <span className="text-[9px] text-muted">{fmt(b.contributions ?? 0)}</span>
            </button>
          ))}
          {missing && (
            <div className="flex items-center justify-between gap-3 border-t-2 border-border px-3 py-2">
              <span className="min-w-0 truncate text-[10px] normal-case text-muted">@{missing} isn&apos;t on the map yet</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(() => onPutOnMap(missing))} className="shrink-0 bg-lime px-2.5 py-1 text-[10px] text-bg">
                Put it on the map
              </button>
            </div>
          )}
          {places.length === 0 && devs.length === 0 && !missing && <p className="px-3 py-2 text-[10px] normal-case text-muted">Nothing on the map called “{query.trim()}”.</p>}
        </div>
      )}
    </div>
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
  viewerLogin,
  forLogin,
  current,
  busy,
  error,
  onPick,
  onSignIn,
  onClose,
}: {
  signedIn: boolean;
  viewerLogin: string | null;
  /** Opened for a username typed in the search (maybe someone else's). */
  forLogin: string | null;
  /** Where you live now: a state, "island", or null when you're not on the map. */
  current: UF | "island" | null;
  busy: boolean;
  error: string | null;
  onPick: (uf: UF | null) => void;
  onSignIn: () => void;
  onClose: () => void;
}) {
  return (
    <Panel title={current ? "Your state" : "Put your building on the map"} onClose={onClose}>
      {forLogin && viewerLogin && forLogin !== viewerLogin.toLowerCase() ? (
        <p className="text-[10px] normal-case text-muted">
          Only @{forLogin} can put their building here: they sign in with GitHub on this page, or comment their @ and state on the reel. You&apos;re signed in as @{viewerLogin}.
        </p>
      ) : !signedIn ? (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] normal-case text-muted">
            {forLogin ? `Is @${forLogin} you? ` : ""}Sign in with GitHub, pick your state, and your building goes up in its city.
          </p>
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
