"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Car, ChevronLeft, Map as MapIcon, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { generateCityLayout, type CityBuilding, type DeveloperRecord, type LayoutNorms } from "@/lib/github";
import { leagueBuildings, scaleTownHeights } from "@/lib/league-city/buildings";
import { createTelemetry, type DriveCameraMode } from "@/lib/league-city/drive/telemetry";
import { smashStoreFor } from "@/lib/league-city/smash";
import { createCameraStore, mapNav } from "@/lib/map-nav";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import type { CrownApi, CrownView } from "@/components/league/drive/CrownMode";
import type { EmoteApi } from "@/components/league/drive/EmoteBubbles";
import { useTouch } from "@/components/towns/useDesktop";
import { createEmoteLog } from "@/lib/league-city/drive/emote-log";
import { createTouch, type TouchDrive } from "@/lib/league-city/drive/touch";
import { loadVolume, saveVolume } from "@/lib/league-city/drive/volume";
import { useDriveWatch } from "@/components/league/drive/useDriveWatch";
import { useTownsLive } from "@/components/towns/live";
import { applyRoomDamage } from "@/lib/league-city/smash-net";
import { inTown } from "@/lib/towns/live";
import type { DriverInfo } from "@/lib/league-city/drive/net";
import BuildingCard from "@/components/league/hud/BuildingCard";
import { fmt } from "@/components/league/hud/shared";
import MapNavControls from "@/components/MapNavControls";
import BrasilScene, { cityKey, type CameraApi } from "@/components/towns/brasil/BrasilScene";
import { LOT, lotToWorld } from "@/lib/league-city/grid";
import BrasilMinimap from "@/components/towns/brasil/BrasilMinimap";
import { BrasilPicker, BrasilRanking, BrasilSearchBar } from "@/components/towns/brasil/BrasilPanels";
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

type PanelId = "states" | null;
const DriveHud = dynamic(() => import("@/components/league/hud/drive/DriveHud"), { ssr: false });
/** The drive's mute switch, shared with every town. */
const MUTE_KEY = "gc:drive-muted";
const LIME = "#c8e64a";

export default function BrasilTown({ league, layout, cityDevs, cityNorms, viewerLogin, home, startAt }: BrasilTownProps) {
  const router = useRouter();
  const camera = useRef<CameraApi | null>(null);
  const cameraStore = useMemo(() => createCameraStore(), []);
  const [telemetry, setTelemetry] = useState(createTelemetry);
  const crownApi = useRef<CrownApi | null>(null);
  const [driving, setDriving] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [state, setState] = useState<StateStats | null>(null);
  const [focused, setFocused] = useState<CityBuilding | null>(null);
  /** The state card a building was opened from: closing the building brings it back. */
  const [backTo, setBackTo] = useState<StateStats | null>(null);
  /** The state picker under the search, for a username typed there (null: yours). */
  const [picker, setPicker] = useState<{ forLogin: string | null } | null>(null);
  const [joining, setJoining] = useState<{ pending: UF | "island" | null; error: string | null }>({
    pending: null,
    error: null,
  });
  /** Just placed: where, until the refreshed map has the building (then the camera goes there). */
  const [arriving, setArriving] = useState<{ uf: UF | null } | null>(null);
  /** The arrival the open card celebrates, and the ring under the new lot. */
  const [arrived, setArrived] = useState<{ login: string; uf: UF | null } | null>(null);
  const [pulse, setPulse] = useState<{ x: number; z: number; key: number } | null>(null);
  const [now] = useState(() => Date.now());
  /** Up close, the city the camera looks at (its cityKey). */
  const [viewKey, setViewKey] = useState<string | null>(null);
  /** Below the whole-country view, the city with people the camera looks at: where Drive starts. */
  const [lookKey, setLookKey] = useState<string | null>(null);
  /** Where the map camera opens back from the car. */
  const [cameraStart, setCameraStart] = useState<{ x: number; z: number } | null>(null);
  /** The car starts at this resident's building, fixed when the drive starts. */
  const [driveDev, setDriveDev] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);
  /** A panel takes the right side: any card closes. */
  const openPanel = (p: PanelId) => {
    setState(null);
    setFocused(null);
    setBackTo(null);
    setPicker(null);
    setPanel(p);
  };
  /** The picker takes over: cards and panels close. */
  const openPicker = (forLogin: string | null) => {
    setState(null);
    setFocused(null);
    setBackTo(null);
    setPanel(null);
    setJoining({ pending: null, error: null });
    setPicker({ forLogin });
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
    const allCities = [...layout.cities, layout.island];
    const cityByKey = new Map(allCities.map((c) => [cityKey(c), c]));
    const cityOfLogin = new Map(allCities.flatMap((c) => c.devs.map((d) => [d.dev.login.toLowerCase(), c] as const)));
    return { objects, buildings, placed, states, devs, founders, ufOf, allCities, cityByKey, cityOfLogin };
  }, [layout, cityDevs, cityNorms, now]);

  const smash = useMemo(() => smashStoreFor(world.buildings), [world.buildings]);

  // The town's drive room: everyone driving sees everyone, and the map shows their cars while you look.
  const [guest] = useState(() => `guest-${Math.random().toString(36).slice(2, 6).padEnd(4, "0")}`);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  // The car's HUD, as in every town: camera, sound, reactions, Crown Rush, pause, phone controls.
  const [driveReady, setDriveReady] = useState(false);
  const [driveCamera, setDriveCamera] = useState<DriveCameraMode>("chase");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [crownView, setCrownView] = useState<CrownView | null>(null);
  const emoteApi = useRef<EmoteApi | null>(null);
  const [emoteLog] = useState(createEmoteLog);
  const touchRef = useRef<TouchDrive>(createTouch());
  const touchUi = useTouch();
  const toggleCamera = useCallback(() => setDriveCamera((c) => (c === "chase" ? "top" : "chase")), []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        // storage blocked
      }
      return !m;
    });
  }, []);
  // The slider: moving it while muted turns the sound back on.
  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    saveVolume(v);
    if (v > 0) {
      setMuted(false);
      try {
        localStorage.setItem(MUTE_KEY, "0");
      } catch {
        // storage blocked
      }
    }
  }, []);
  const exitDrive = useCallback(() => {
    // The map opens where the car stopped.
    const r = telemetry.radar;
    setCameraStart(r && (r.x || r.z) ? { x: r.x, z: r.z } : null);
    setDriving(false);
    setPaused(false);
    setDrivers([]);
    setCrownView(null);
    emoteLog.clear();
  }, [emoteLog, telemetry]);
  // Esc pauses; Esc again on the pause menu leaves the car.
  useEffect(() => {
    if (!driving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      e.preventDefault();
      if (paused) exitDrive();
      else setPaused(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [driving, paused, exitDrive]);
  const watch = useDriveWatch(league.slug, !driving, (msg) => applyRoomDamage(smash, msg, Date.now()));
  const watchedCars = useMemo(() => watch.drivers.flatMap((d) => watch.remotes.current.get(d.id) ?? []), [watch.drivers, watch.remotes]);
  // Who's here now (the drive room reports to the towns tally), plus the drivers the room just told us about.
  const live = useTownsLive()[league.slug];
  const here = Math.max(live ? inTown(live) : 0, 1);
  const drivingNow = driving ? drivers.length : watch.drivers.length;
  const noop = useCallback(() => {}, []);

  // The phone's back button walks the same steps as ‹: a building, its state, the whole country.
  const applying = useRef(false);
  const pushUrl = useCallback((q: string) => {
    if (applying.current) return;
    const next = q ? `${window.location.pathname}?${q}` : window.location.pathname;
    if (next === window.location.pathname + window.location.search) return;
    window.history.pushState({ brasil: true }, "", next);
  }, []);

  /** Closing a card: the address follows without a new step. */
  const replaceUrl = (q: string) => window.history.replaceState(window.history.state, "", q ? `${window.location.pathname}?${q}` : window.location.pathname);

  const openState = useCallback(
    (uf: UF) => {
      const s = world.states.find((x) => x.uf === uf);
      if (!s) return;
      pushUrl(`uf=${uf}`);
      setFocused(null);
      setBackTo(null);
      setPanel(null);
      setPicker(null);
      setState(s);
      camera.current?.flyTo(s.capital.center, s.capital.radius);
    },
    [world.states, pushUrl],
  );
  const openBuilding = useCallback(
    (b: CityBuilding) => {
      pushUrl(`at=${b.loginLower}`);
      setState(null);
      setPanel(null);
      setFocused(b);
      mapNav.send({ type: "flyTo", x: b.position[0], z: b.position[2], distance: 700 });
    },
    [pushUrl],
  );
  /** Back to the whole country: every card closes. */
  const toBrazil = useCallback(() => {
    setState(null);
    setFocused(null);
    setBackTo(null);
    setPanel(null);
    setPicker(null);
    camera.current?.flyTo(null);
  }, []);
  // Back (the phone's, or ‹ after a step this page took): show what the address says.
  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      applying.current = true;
      const at = q.get("at");
      const uf = q.get("uf");
      const b = at ? world.placed.get(at.toLowerCase()) : undefined;
      if (b) openBuilding(b);
      else if (uf && world.states.some((s) => s.uf === uf)) openState(uf as UF);
      else if (state) toBrazil();
      else {
        // Back from a building opened on the map: close it, stay over its streets.
        setFocused(null);
        setBackTo(null);
      }
      applying.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [world, openBuilding, openState, toBrazil, state]);
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

  // Where you are: the building's city, the open state, or the city the camera is over.
  const place = (focused ? world.cityOfLogin.get(focused.loginLower) : undefined) ?? state?.capital ?? (viewKey ? world.cityByKey.get(viewKey) : undefined) ?? null;
  /** The building the car starts at: the open one, else the city you're over, else yours, else the biggest state's. */
  const driveStartDev = (): { id: number; login: string } | null => {
    const pickIn = (c: CityLayout | null | undefined) => (c && c.devs.length ? c.devs[0].dev : null);
    const own = viewerLogin ? world.cityOfLogin.get(viewerLogin.toLowerCase())?.devs.find((d) => d.dev.login.toLowerCase() === viewerLogin.toLowerCase())?.dev : null;
    const dev =
      (focused ? world.cityOfLogin.get(focused.loginLower)?.devs.find((d) => d.dev.login.toLowerCase() === focused.loginLower)?.dev : null) ??
      pickIn(place) ??
      pickIn(lookKey ? world.cityByKey.get(lookKey) : null) ??
      own ??
      pickIn(world.states.find((s) => s.devs > 0)?.capital) ??
      pickIn(layout.island);
    return dev ? { id: dev.id, login: dev.login } : null;
  };
  const driveFrom = driveDev;

  /** ‹: one step up. A building goes back to its state's card (or just closes), a city to the whole country, the country to the towns. */
  const closeBuilding = () => {
    setFocused(null);
    setArrived(null);
    // Opened from a state's card: back to it, and back over its city.
    if (backTo) {
      setState(backTo);
      setBackTo(null);
      camera.current?.flyTo(backTo.capital.center, backTo.capital.radius);
      replaceUrl(`uf=${backTo.uf}`);
    } else replaceUrl("");
  };
  const goUp = () => {
    if (focused) return closeBuilding();
    if (state || place) {
      toBrazil();
      replaceUrl("");
      return;
    }
    router.push("/towns");
  };
  const drive = useMemo(
    () => ({
      viewerDevId: driveFrom,
      touch: touchRef,
      telemetry,
      camera: driveCamera,
      onCameraToggle: toggleCamera,
      muted,
      volume,
      emoteApi,
      onEmoteLog: emoteLog.push,
      paused,
      stallAt: null,
      onReady: () => setDriveReady(true),
      onFail: exitDrive,
      slug: league.slug,
      name: viewerLogin ?? guest,
      onDrivers: setDrivers,
      onHonk: noop,
      crownApi,
      onCrown: setCrownView,
    }),
    [telemetry, noop, driveFrom, league.slug, viewerLogin, guest, driveCamera, toggleCamera, muted, volume, emoteLog, paused, exitDrive],
  );
  // The drive minimap: the map around the car, and your building.
  const driveMap = useMemo(
    () => ({
      buildings: world.buildings,
      objects: world.objects,
      home: viewerLogin?.toLowerCase() ?? null,
    }),
    [world, viewerLogin],
  );
  const startDrive = () => {
    const dev = driveStartDev();
    const b = dev ? world.placed.get(dev.login.toLowerCase()) : undefined;
    if (!dev || !b || launching) return;
    setState(null);
    setFocused(null);
    setBackTo(null);
    setPanel(null);
    setPicker(null);
    setDriveDev(dev.id);
    setLaunching(true);
    // Down to the street first, so the car starts somewhere you just saw.
    const go = () => {
      setLaunching(false);
      beginDrive();
    };
    if (camera.current) camera.current.flyToPoint(b.position[0], b.position[2], 420, go);
    else go();
  };
  const beginDrive = () => {
    setDriveReady(false);
    setPaused(false);
    setTelemetry(createTelemetry());
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
      setVolume(loadVolume());
    } catch {
      // storage blocked: sound stays on
    }
    setDriving(true);
  };

  const pickState = async (uf: UF | null) => {
    setJoining({ pending: uf ?? "island", error: null });
    try {
      const res = await fetch(`/api/towns/${league.slug}/brasil/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uf }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setJoining({ pending: null, error: body.error ?? "Couldn't put you on the map." });
      // The picker stays (saying "finding your lot") until the refreshed map has the building.
      setArriving({ uf });
      router.refresh();
    } catch {
      setJoining({ pending: null, error: "Couldn't put you on the map." });
    }
  };

  // The refreshed map has your building where you picked: fly there, ring the lot, open your card.
  useEffect(() => {
    if (!arriving || !viewerLogin) return;
    const login = viewerLogin.toLowerCase();
    const b = world.placed.get(login);
    if (!b || (world.ufOf.get(login)?.uf ?? null) !== arriving.uf) return;
    const t = setTimeout(() => {
      setArriving(null);
      setPicker(null);
      setJoining({ pending: null, error: null });
      setArrived({ login, uf: arriving.uf });
      setPulse({ x: b.position[0], z: b.position[2], key: Date.now() });
      openBuilding(b);
    }, 0);
    return () => clearTimeout(t);
  }, [arriving, viewerLogin, world, openBuilding]);
  const signIn = () => void signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?next=/town/${league.slug}`);

  const yours = home && home !== "island" ? home : null;
  const top = world.states.filter((s) => s.devs > 0).slice(0, 3);
  const bar = "flex flex-col items-center justify-center gap-1 bg-[#141417] py-2 text-[9px] text-cream hover:text-lime sm:h-10 sm:flex-row sm:gap-2 sm:px-3 sm:py-0 sm:text-[11px]";

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
        pulse={pulse}
        watching={watchedCars}
        onCity={(key, looking) => {
          setViewKey(key);
          setLookKey(looking);
        }}
        cameraStart={cameraStart}
      />

      {/* The top: where you are on one line, ‹ one step up (a building, its city, the whole country, the towns), the search under it. */}
      {!driving && (
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center sm:inset-x-auto sm:left-1/2 sm:top-4 sm:-translate-x-1/2">
          <div className="flex h-9 min-w-0 items-stretch bg-bg/90 text-[10px] tabular-nums sm:h-8 sm:text-[11px] max-sm:w-full">
            <button
              type="button"
              onClick={goUp}
              aria-label={focused ? "Close the building" : place ? "Back to Brazil" : "Back to towns"}
              className="pointer-events-auto flex w-9 shrink-0 items-center justify-center border-r border-border text-muted hover:text-cream sm:w-8"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <p className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3">
              {place ? (
                <>
                  <span className="h-2 w-2 shrink-0 border border-border-light" style={{ background: place.uf ? swatchOf(place.uf) : LIME }} aria-hidden />
                  <span className="truncate text-cream">{place.uf ? place.name : "Island"}</span>
                  {place.uf && <span className="text-muted">{place.uf}</span>}
                  <span className="text-muted">{fmt(place.devs.length)} devs</span>
                </>
              ) : (
                <>
                  <span style={{ color: LIME }}>Brasil</span>
                  <span className="text-cream">{fmt(world.devs)} devs</span>
                  <span className="text-muted max-sm:hidden">{world.founders}/27 founded</span>
                </>
              )}
              <span className="flex items-center gap-1.5 text-cream">
                <span className="blink-dot inline-block h-1.5 w-1.5 shrink-0 bg-lime" aria-hidden />
                {fmt(here)} here{drivingNow > 0 ? ` · ${fmt(drivingNow)} driving` : ""}
              </span>
            </p>
          </div>
        </div>
      )}

      {!driving && (
        <div className="absolute inset-x-3 top-[52px] z-30 sm:inset-x-auto sm:left-1/2 sm:top-[48px] sm:-translate-x-1/2">
          <BrasilSearchBar
            cities={layout.cities}
            island={layout.island}
            buildings={world.buildings}
            onPickCity={(c) => (setPicker(null), openCity(c))}
            onPickBuilding={(b) => (setPicker(null), openBuilding(b))}
            onPutOnMap={openPicker}
          />
          {picker && (
            <BrasilPicker
              signedIn={!!viewerLogin}
              viewerLogin={viewerLogin}
              forLogin={picker.forLogin}
              current={home}
              pending={joining.pending}
              error={joining.error}
              onPick={pickState}
              onSignIn={signIn}
              onClose={() => setPicker(null)}
            />
          )}
        </div>
      )}

      {top.length > 0 && !driving && !state && !focused && !panel && (
        <div className="pointer-events-auto absolute right-4 top-4 flex flex-col gap-1 text-[11px] max-sm:hidden">
          {top.map((t, i) => (
            <button
              key={t.uf}
              type="button"
              onClick={() => openState(t.uf)}
              className={`flex justify-between gap-4 px-3 py-1 text-left ${i === 0 ? "bg-lime text-bg" : "bg-[#141417] text-cream hover:text-lime"}`}
            >
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
        <span className="pointer-events-none fixed bottom-1 left-1.5 z-20 text-[9px] normal-case leading-none text-muted/60 max-sm:bottom-[66px] max-sm:text-[8px]">
          Map data: IBGE · Natural Earth
        </span>
      )}

      {/* The bar: a row of words on a desktop, a tab bar of icons on a phone. */}
      {!driving && (
        <nav className="pointer-events-auto absolute inset-x-0 bottom-0 grid grid-cols-4 gap-px border-t-2 border-border bg-border pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_0_rgba(0,0,0,0.25)] sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:flex sm:-translate-x-1/2 sm:border-t-0 sm:bg-transparent sm:pb-0 sm:shadow-[0_6px_0_rgba(0,0,0,0.35)]">
          <button type="button" onClick={() => openPanel("states")} className={bar}>
            <Trophy size={16} className="sm:hidden" aria-hidden />
            States
          </button>
          <button
            type="button"
            onClick={() => {
              setState(null);
              setFocused(null);
              setPanel(null);
              setPicker(null);
              camera.current?.flyTo(null);
            }}
            className={bar}
          >
            <MapIcon size={16} className="sm:hidden" aria-hidden />
            Brazil
          </button>
          <button type="button" disabled={launching || world.devs === 0} onClick={startDrive} className={`${bar} disabled:opacity-40`}>
            <Car size={16} className="sm:hidden" aria-hidden />
            Drive
          </button>
          <button
            type="button"
            onClick={() => {
              // On the map: to your building. Not yet: the way in.
              const mine = home && viewerLogin ? world.placed.get(viewerLogin.toLowerCase()) : undefined;
              if (mine) openBuilding(mine);
              else openPicker(null);
            }}
            className="flex flex-col items-center justify-center gap-1 bg-lime py-2 text-[9px] text-bg sm:h-10 sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-[11px]"
          >
            {yours ? <span className="h-3 w-3 border border-bg/40 sm:h-2.5 sm:w-2.5" style={{ background: swatchOf(yours) }} aria-hidden /> : <Building2 size={16} className="sm:hidden" aria-hidden />}
            {home ? (
              "My building"
            ) : (
              <>
                <span className="sm:hidden">Put mine</span>
                <span className="max-sm:hidden">Put my building</span>
              </>
            )}
          </button>
        </nav>
      )}

      {driving && driveReady && <AreaTitle telemetry={telemetry} cities={world.allCities} />}
      {driving && (
        <DriveHud
          firstRun={false}
          touchRef={touchUi ? touchRef : undefined}
          telemetry={telemetry}
          ready={driveReady}
          camera={driveCamera}
          muted={muted}
          volume={volume}
          paused={paused}
          gated={false}
          held={false}
          join={!viewerLogin ? { label: "Sign in", short: "Sign in", signIn: true, onClick: signIn } : undefined}
          drivers={drivers}
          crown={crownView}
          map={driveMap}
          emoteLog={emoteLog}
          onVolume={changeVolume}
          onEmote={(e) => emoteApi.current?.send(e)}
          onStartCrown={() => crownApi.current?.start()}
          onResume={() => setPaused(false)}
          onCamera={toggleCamera}
          onMute={toggleMute}
          onExit={exitDrive}
        />
      )}

      {panel === "states" && <BrasilRanking states={world.states} yours={yours} onPick={(s) => openState(s.uf)} onClose={() => setPanel(null)} />}

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
          onClose={() => {
            setState(null);
            replaceUrl("");
          }}
        />
      )}
      {focused && !driving && (
        <BuildingCard
          key={focused.loginLower}
          building={focused}
          viewerLogin={viewerLogin}
          section={
            <>
              {arrived?.login === focused.loginLower && <Arrival uf={arrived.uf} states={world.states} founder={!!world.ufOf.get(focused.loginLower)?.founder} townPath={`/town/${league.slug}`} />}
              <ResidentRow
                login={focused.loginLower}
                ufOf={world.ufOf}
                states={world.states}
                onState={openState}
                onMove={viewerLogin?.toLowerCase() === focused.loginLower ? () => openPicker(null) : undefined}
              />
            </>
          }
          onDriveTo={startDrive}
          onClose={closeBuilding}
        />
      )}
    </main>
  );
}

/**
 * Driving: the city's name over the road as you come into it (and when the
 * car starts), like a game naming the area you just entered. Out between
 * cities nothing shows; coming back into the same city doesn't repeat it.
 */
function AreaTitle({ telemetry, cities }: { telemetry: { radar: { x: number; z: number } }; cities: CityLayout[] }) {
  const [shown, setShown] = useState<{ city: CityLayout; at: number } | null>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const { x, z } = telemetry.radar;
      if (!x && !z) return;
      let here: CityLayout | null = null;
      for (const c of cities) {
        const [cx, cz] = lotToWorld(...c.center);
        if (Math.hypot(cx - x, cz - z) < (c.radius + 2) * LOT) here = c;
      }
      const key = here ? cityKey(here) : null;
      if (key && key !== last.current) setShown({ city: here!, at: Date.now() });
      if (key) last.current = key;
    }, 400);
    return () => clearInterval(id);
  }, [telemetry, cities]);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown) return null;
  const c = shown.city;
  return (
    <div key={shown.at} className="area-title pointer-events-none fixed inset-x-0 top-[22%] z-30 flex flex-col items-center gap-1.5 text-center font-pixel uppercase">
      {c.uf && stateOf(c.uf).name !== c.name && <span className="text-[10px] tracking-[0.3em] text-muted">{stateOf(c.uf).name}</span>}
      <span className="text-3xl text-cream [text-shadow:0_3px_0_rgba(0,0,0,0.6)] sm:text-5xl">{c.uf ? c.name : "The island"}</span>
      <span className="text-[10px] text-lime">{fmt(c.devs.length)} devs live here</span>
    </div>
  );
}

/** Your card right after you're placed: where you landed, what you are there, and the invite. */
function Arrival({ uf, states, founder, townPath }: { uf: UF | null; states: StateStats[]; founder: boolean; townPath: string }) {
  const [copied, setCopied] = useState(false);
  const s = uf ? states.find((x) => x.uf === uf) : null;
  const invite = () => {
    const url = `${window.location.origin}${townPath}${uf ? `?uf=${uf}` : ""}`;
    const text = uf ? `I'm on the Brasil map in Git City, in ${stateOf(uf).name}. Put yourself on it: ${url}` : `I'm on the Brasil map in Git City. Put yourself on it: ${url}`;
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  return (
    <div className="mx-4 mb-3 border-2 border-lime px-3 py-2.5">
      <p className="text-[8px] text-lime">You&apos;re on the map</p>
      <p className="mt-1 text-sm text-cream">{s ? (founder ? `Founder of ${s.name}` : `You're in ${s.name}`) : "You're on the island"}</p>
      <p className="mt-0.5 text-[9px] normal-case text-muted">
        {s ? (founder ? `The first dev in ${s.uf}. Everyone after you lives in your city.` : `Dev #${fmt(s.devs)} in ${s.uf} · #${s.place} of 27 states`) : "No state yet. Pick one anytime with Move."}
      </p>
      <button type="button" onClick={invite} className="btn-press mt-2 w-full border-2 border-lime bg-lime py-1.5 text-[10px] text-bg">
        {copied ? "Invite copied" : s ? `Invite to ${s.uf}` : "Invite a friend"}
      </button>
    </div>
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
