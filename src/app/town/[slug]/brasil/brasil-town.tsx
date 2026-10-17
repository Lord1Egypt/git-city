"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { generateCityLayout, type CityBuilding, type DeveloperRecord, type LayoutNorms } from "@/lib/github";
import { leagueBuildings, scaleTownHeights } from "@/lib/league-city/buildings";
import { createTelemetry } from "@/lib/league-city/drive/telemetry";
import { smashStoreFor } from "@/lib/league-city/smash";
import type { CrownApi } from "@/components/league/drive/CrownMode";
import BrasilScene, { type CameraApi } from "@/components/towns/brasil/BrasilScene";
import { ranking, type BrasilLayout, type CityLayout } from "@/lib/towns/brasil-map";
import { brasilWorld } from "@/lib/towns/brasil-world";

// The Brasil town's page: the map of Brazil with the town's residents, each
// in their state's city, their buildings sized like everywhere in Git City.
// The counter and the top states over it; a tag flies to its city.

export interface BrasilTownProps {
  league: { slug: string; name: string };
  layout: BrasilLayout;
  /** Every resident's city record (main-city size, lit windows). */
  cityDevs: Record<string, unknown>[];
  cityNorms: LayoutNorms;
  viewerLogin: string | null;
}

const LIME = "#c8e64a";

export default function BrasilTown({ league, layout, cityDevs, cityNorms }: BrasilTownProps) {
  const camera = useRef<CameraApi | null>(null);
  const telemetry = useMemo(() => createTelemetry(), []);
  const crownApi = useRef<CrownApi | null>(null);
  const [driving, setDriving] = useState(false);
  const [focus, setFocus] = useState<CityLayout | null>(null);

  const world = useMemo(() => {
    const records = generateCityLayout(cityDevs as unknown as DeveloperRecord[], undefined, cityNorms).buildings;
    const byLogin = new Map(records.map((b) => [b.loginLower, b]));
    const { objects, byDevId } = brasilWorld(layout, (dev) => byLogin.get(dev.login.toLowerCase()) ?? fallback(dev.login), 1);
    const buildings = leagueBuildings(objects, scaleTownHeights(byDevId));
    const top = ranking(layout);
    const devs = [...layout.cities, layout.island].reduce((n, c) => n + c.devs.length, 0);
    const founders = layout.cities.filter((c) => !c.second && c.devs.length > 0).length;
    return { objects, buildings, top: top.slice(0, 3), devs, founders };
  }, [layout, cityDevs, cityNorms]);

  const smash = useMemo(() => smashStoreFor(world.buildings), [world.buildings]);
  const noop = useCallback(() => {}, []);
  const driveFrom = focus?.devs[0]?.dev.id ?? layout.cities.find((c) => c.uf === world.top[0]?.uf && !c.second)?.devs[0]?.dev.id ?? null;
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
  const onTag = useCallback((c: CityLayout) => {
    setFocus(c);
    camera.current?.flyTo(c.center, c.radius);
  }, []);

  return (
    <main className="fixed inset-0 bg-bg font-pixel uppercase text-cream">
      <BrasilScene
        cities={layout.cities}
        island={layout.island}
        objects={world.objects}
        buildings={world.buildings}
        cameraApi={camera}
        onTag={onTag}
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
          {world.devs.toLocaleString("en-US")} devs
        </span>
        <span className="bg-bg/85 px-3 py-1 text-[11px] text-muted">
          {world.founders}/27 states with a founder · {layout.island.devs.length} on the island
        </span>
      </div>

      {world.top.length > 0 && (
        <div className="pointer-events-none absolute right-4 top-4 flex flex-col gap-1 text-[11px]">
          {world.top.map((t, i) => (
            <span key={t.uf} className={`flex justify-between gap-4 px-3 py-1 ${i === 0 ? "bg-lime text-bg" : "bg-[#141417] text-cream"}`}>
              <span>
                {i + 1}. {t.uf}
              </span>
              <span>{t.devs}</span>
            </span>
          ))}
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => {
            setDriving(false);
            setFocus(null);
            camera.current?.flyTo(null);
          }}
          className="bg-[#141417] px-3 py-2 text-cream hover:text-lime"
        >
          Brazil
        </button>
        <button type="button" disabled={driveFrom === null} onClick={() => setDriving((d) => !d)} className="bg-cream px-3 py-2 text-bg disabled:opacity-40">
          {driving ? "Stop" : focus?.uf ? `Drive ${focus.uf}` : "Drive"}
        </button>
      </div>
    </main>
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
