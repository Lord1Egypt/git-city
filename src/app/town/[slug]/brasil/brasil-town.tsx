"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateCityLayout, type CityBuilding, type DeveloperRecord, type LayoutNorms } from "@/lib/github";
import { leagueBuildings, scaleTownHeights } from "@/lib/league-city/buildings";
import { createTelemetry } from "@/lib/league-city/drive/telemetry";
import { smashStoreFor } from "@/lib/league-city/smash";
import { createCameraStore, mapNav } from "@/lib/map-nav";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import type { CrownApi } from "@/components/league/drive/CrownMode";
import BuildingCard from "@/components/league/hud/BuildingCard";
import { fmt } from "@/components/league/hud/shared";
import MapNavControls from "@/components/MapNavControls";
import BrasilScene, { type CameraApi } from "@/components/towns/brasil/BrasilScene";
import BrasilMinimap from "@/components/towns/brasil/BrasilMinimap";
import { BrasilJoin, BrasilRanking, BrasilSearchBar } from "@/components/towns/brasil/BrasilPanels";
import StateCard from "@/components/towns/brasil/StateCard";
import { stateStats, swatchOf, type StateStats } from "@/components/towns/brasil/stats";
import { stateOf, type BrasilLayout, type CityLayout, type UF } from "@/lib/towns/brasil-map";
import { brasilWorld } from "@/lib/towns/brasil-world";

// The Brasil town's page: the map of Brazil with the town's residents, each
// in their state's city, their buildings sized like everywhere in Git City.
// Over it: the counter and the top states; a bar to search the map, rank the
// states and pick your state; a state's card from its tag, a dev's from their
// building; the compass, the zoom and a minimap. ?uf=SP opens a state,
// ?at=login a building.

export interface BrasilTownProps {
  league: { slug: string; name: string };
  layout: BrasilLayout;
  /** Every resident's city record (main-city size, lit windows). */
  cityDevs: Record<string, unknown>[];
  cityNorms: LayoutNorms;
  viewerLogin: string | null;
  /** Where the viewer lives on the map, or null when they're not on it. */
  home: UF | "island" | null;
  /** Open on a state or a building. */
  startAt: { uf: string } | { login: string } | null;
}

type PanelId = "states" | "join" | null;
const LIME = "#c8e64a";

export default function BrasilTown({ league, layout, cityDevs, cityNorms, viewerLogin, home, startAt }: BrasilTownProps) {
  const router = useRouter();
  const camera = useRef<CameraApi | null>(null);
  const cameraStore = useMemo(() => createCameraStore(), []);
  const telemetry = useMemo(() => createTelemetry(), []);
  const crownApi = useRef<CrownApi | null>(null);
  const [driving, setDriving] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [state, setState] = useState<StateStats | null>(null);
  const [focused, setFocused] = useState<CityBuilding | null>(null);
  /** The state card a building was opened from: closing the building brings it back. */
  const [backTo, setBackTo] = useState<StateStats | null>(null);
  const [joining, setJoining] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  /** The username typed in the search that isn't on the map (the join panel speaks to them). */
  const [joinFor, setJoinFor] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  /** A panel takes the right side: any card closes. */
  const openPanel = (p: PanelId) => {
    setState(null);
    setFocused(null);
    setBackTo(null);
    setPanel(p);
  };

  const world = useMemo(() => {
    const records = generateCityLayout(cityDevs as unknown as DeveloperRecord[], undefined, cityNorms).buildings;
    const byLogin = new Map(records.map((b) => [b.loginLower, b]));
    const { objects, byDevId } = brasilWorld(layout, (dev) => byLogin.get(dev.login.toLowerCase()) ?? fallback(dev.login), 1);
    const buildings = leagueBuildings(objects, scaleTownHeights(byDevId));
    const placed = new Map(buildings.map((b) => [b.loginLower, b]));
    const states = stateStats(layout, placed, now);
    const devs = [...layout.cities, layout.island].reduce((n, c) => n + c.devs.length, 0);
    const founders = layout.cities.filter((c) => !c.second && c.devs.length > 0).length;
    // Which state each resident said, for their card.
    const ufOf = new Map([...layout.cities, layout.island].flatMap((c) => c.devs.map((d) => [d.dev.login.toLowerCase(), { uf: d.dev.uf, founder: d.founder }] as const)));
    return { objects, buildings, placed, states, devs, founders, ufOf };
  }, [layout, cityDevs, cityNorms, now]);

  const smash = useMemo(() => smashStoreFor(world.buildings), [world.buildings]);
  const noop = useCallback(() => {}, []);

  const openState = useCallback(
    (uf: UF) => {
      const s = world.states.find((x) => x.uf === uf);
      if (!s) return;
      setFocused(null);
      setBackTo(null);
      setPanel(null);
      setState(s);
      camera.current?.flyTo(s.capital.center, s.capital.radius);
    },
    [world.states],
  );
  const openBuilding = useCallback((b: CityBuilding) => {
    setState(null);
    setPanel(null);
    setFocused(b);
    mapNav.send({ type: "flyTo", x: b.position[0], z: b.position[2], distance: 700 });
  }, []);
  const openCity = useCallback(
    (c: CityLayout) => {
      if (c.uf) return openState(c.uf);
      setState(null);
      setPanel(null);
      camera.current?.flyTo(c.center, c.radius);
    },
    [openState],
  );

  // ?uf=SP or ?at=login: open there once the map is up.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !startAt) return;
    const t = setTimeout(() => {
      started.current = true;
      if ("uf" in startAt) {
        const uf = world.states.find((s) => s.uf === startAt.uf)?.uf;
        if (uf) openState(uf);
      } else {
        const b = world.placed.get(startAt.login);
        if (b) openBuilding(b);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [startAt, world, openState, openBuilding]);

  // Drive from the building or the state in view (or the biggest state).
  const driveFrom =
    (focused ? layout.cities.concat(layout.island).flatMap((c) => c.devs).find((d) => d.dev.login.toLowerCase() === focused.loginLower)?.dev.id : undefined) ??
    state?.capital.devs[0]?.dev.id ??
    world.states.find((s) => s.devs > 0)?.capital.devs[0]?.dev.id ??
    null;
  const drive = useMemo(
    () => ({
      offline: true,
      viewerDevId: driveFrom,
      telemetry,
      camera: "chase" as const,
      onCameraToggle: noop,
      muted: false,
      paused: false,
      stallAt: null,
      onReady: noop,
      onFail: () => setDriving(false),
      slug: league.slug,
      name: "guest",
      onDrivers: noop,
      onHonk: noop,
      crownApi,
      onCrown: noop,
    }),
    [telemetry, noop, driveFrom, league.slug],
  );
  const startDrive = () => {
    setState(null);
    setFocused(null);
    setBackTo(null);
    setPanel(null);
    setDriving(true);
  };

  const pickState = async (uf: UF | null) => {
    setJoining({ busy: true, error: null });
    try {
      const res = await fetch(`/api/towns/${league.slug}/brasil/place`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uf }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setJoining({ busy: false, error: body.error ?? "Couldn't put you on the map." });
      setJoining({ busy: false, error: null });
      setPanel(null);
      router.refresh();
    } catch {
      setJoining({ busy: false, error: "Couldn't put you on the map." });
    }
  };
  const signIn = () => void signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?next=/town/${league.slug}`);

  const yours = home && home !== "island" ? home : null;
  const top = world.states.filter((s) => s.devs > 0).slice(0, 3);
  const bar = "flex h-10 items-center gap-2 bg-[#141417] px-3 text-[11px] text-cream hover:text-lime";

  return (
    <main className="fixed inset-0 bg-bg font-pixel uppercase text-cream">
      <BrasilScene
        cities={layout.cities}
        island={layout.island}
        objects={world.objects}
        buildings={world.buildings}
        cameraApi={camera}
        cameraStore={cameraStore}
        onTag={openCity}
        onBuildingClick={(b) => {
          // From a state's card (or a building opened from it): closing comes back to that card.
          const from = state ?? backTo;
          openBuilding(b);
          if (from) setBackTo(from);
        }}
        focused={focused?.loginLower ?? null}
        drive={driving && driveFrom !== null ? drive : undefined}
        smash={smash}
      />

      <div className="pointer-events-auto absolute left-4 top-4">
        <Link href="/towns" className="bg-bg/85 px-3 py-2 text-[11px] text-muted hover:text-cream">
          ← Towns
        </Link>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
        <span className="bg-bg/85 px-4 py-2 text-2xl" style={{ color: LIME }}>
          {fmt(world.devs)} devs
        </span>
        <span className="bg-bg/85 px-3 py-1 text-[11px] text-muted">
          {world.founders}/27 states with a founder · {layout.island.devs.length} on the island
        </span>
      </div>

      {!driving && (
        <div className="absolute left-1/2 top-[108px] z-30 -translate-x-1/2">
          <BrasilSearchBar
            cities={layout.cities}
            island={layout.island}
            buildings={world.buildings}
            onPickCity={openCity}
            onPickBuilding={openBuilding}
            onPutOnMap={(login) => {
              setJoinFor(login);
              openPanel("join");
            }}
          />
        </div>
      )}

      {top.length > 0 && !state && !focused && !panel && (
        <div className="pointer-events-auto absolute right-4 top-4 flex flex-col gap-1 text-[11px]">
          {top.map((t, i) => (
            <button key={t.uf} type="button" onClick={() => openState(t.uf)} className={`flex justify-between gap-4 px-3 py-1 text-left ${i === 0 ? "bg-lime text-bg" : "bg-[#141417] text-cream hover:text-lime"}`}>
              <span>
                {i + 1}. {t.uf}
              </span>
              <span>{fmt(t.devs)}</span>
            </button>
          ))}
        </div>
      )}

      {!driving && <MapNavControls camera={cameraStore} accent={LIME} showPlaces={false} />}
      {!driving && <BrasilMinimap cities={layout.cities} island={layout.island} camera={cameraStore} />}
      {!driving && (
        <span className="pointer-events-none fixed bottom-1 right-1.5 z-20 text-[9px] normal-case leading-none text-muted/60">
          Map data: IBGE · Natural Earth
        </span>
      )}

      {/* The bar */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-stretch gap-px shadow-[0_6px_0_rgba(0,0,0,0.35)]">
        {driving ? (
          <button type="button" onClick={() => setDriving(false)} className={bar}>
            Stop driving
          </button>
        ) : (
          <>
            <button type="button" onClick={() => openPanel("states")} className={bar}>
              States
            </button>
            <button
              type="button"
              onClick={() => {
                setState(null);
                setFocused(null);
                setPanel(null);
                camera.current?.flyTo(null);
              }}
              className={bar}
            >
              Brazil
            </button>
            <button type="button" disabled={driveFrom === null} onClick={startDrive} className={`${bar} disabled:opacity-40`}>
              Drive
            </button>
            <button
              type="button"
              onClick={() => {
                // On the map: to your building. Not yet: the way in.
                const mine = home && viewerLogin ? world.placed.get(viewerLogin.toLowerCase()) : undefined;
                if (mine) openBuilding(mine);
                else {
                  setJoinFor(null);
                  openPanel("join");
                }
              }}
              className="flex h-10 items-center gap-2 bg-lime px-4 text-[11px] text-bg"
            >
              {home ? (
                <>
                  {yours && <span className="h-2.5 w-2.5 border border-bg/40" style={{ background: swatchOf(yours) }} aria-hidden />}
                  My building
                </>
              ) : (
                "Put my building"
              )}
            </button>
          </>
        )}
      </div>

      {panel === "states" && <BrasilRanking states={world.states} yours={yours} onPick={(s) => openState(s.uf)} onClose={() => setPanel(null)} />}
      {panel === "join" && (
        <BrasilJoin
          signedIn={!!viewerLogin}
          viewerLogin={viewerLogin}
          forLogin={joinFor}
          current={home}
          busy={joining.busy}
          error={joining.error}
          onPick={pickState}
          onSignIn={signIn}
          onClose={() => setPanel(null)}
        />
      )}

      {state && !driving && (
        <StateCard
          key={state.uf}
          state={state}
          byLogin={world.placed}
          townPath={`/town/${league.slug}`}
          onPickDev={(login) => {
            const b = world.placed.get(login.toLowerCase());
            if (!b) return;
            openBuilding(b);
            setBackTo(state);
          }}
          onDriveHere={state.devs > 0 ? startDrive : undefined}
          onClose={() => setState(null)}
        />
      )}
      {focused && !driving && (
        <BuildingCard
          key={focused.loginLower}
          building={focused}
          viewerLogin={viewerLogin}
          section={
            <ResidentRow
              login={focused.loginLower}
              ufOf={world.ufOf}
              states={world.states}
              onState={openState}
              onMove={viewerLogin?.toLowerCase() === focused.loginLower ? () => (setJoinFor(null), openPanel("join")) : undefined}
            />
          }
          onDriveTo={startDrive}
          onClose={() => {
            setFocused(null);
            // Opened from a state's card: back to it, and back over its city.
            if (backTo) {
              setState(backTo);
              setBackTo(null);
              camera.current?.flyTo(backTo.capital.center, backTo.capital.radius);
            }
          }}
        />
      )}
    </main>
  );
}

/** A resident's state on their building card: the state (a click opens it), founder, place there. */
function ResidentRow({
  login,
  ufOf,
  states,
  onState,
  onMove,
}: {
  login: string;
  ufOf: ReadonlyMap<string, { uf: UF | null; founder: boolean }>;
  states: StateStats[];
  onState: (uf: UF) => void;
  /** Your own building: change state. */
  onMove?: () => void;
}) {
  const r = ufOf.get(login);
  const s = r?.uf ? states.find((x) => x.uf === r.uf) : null;
  const inState = s ? s.top.findIndex((l) => l.toLowerCase() === login) : -1;
  return (
    <div className="mx-4 mb-3 flex items-center justify-between gap-2 border-2 border-border px-3 py-2">
      {s ? (
        <button type="button" onClick={() => onState(s.uf)} className="flex items-center gap-2 text-[9px] text-cream hover:text-lime">
          <span className="h-2.5 w-2.5" style={{ background: swatchOf(s.uf) }} aria-hidden />
          {stateOf(s.uf).name}
        </button>
      ) : (
        <span className="text-[9px] text-muted">The island · no state</span>
      )}
      <span className="flex items-center gap-2 text-[9px] text-muted">
        {r?.founder ? <span className="text-lime">Founder</span> : inState >= 0 ? `Top ${inState + 1} in ${s?.uf}` : ""}
        {onMove && (
          <button type="button" onClick={onMove} className="text-cream underline hover:text-lime">
            Move
          </button>
        )}
      </span>
    </div>
  );
}

/** A plain building for a resident the city has no record of yet. */
function fallback(login: string): CityBuilding {
  return {
    login,
    loginLower: login.toLowerCase(),
    position: [0, 0, 0],
    width: 24,
    depth: 24,
    height: 20,
    floors: 3,
    windowsPerFloor: 4,
    sideWindowsPerFloor: 4,
    litPercentage: 0.4,
  } as unknown as CityBuilding;
}
