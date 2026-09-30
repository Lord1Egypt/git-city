"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateCityLayout,
  type CityBuilding,
  type DeveloperRecord,
  type LayoutNorms,
} from "@/lib/github";
import type { LeagueCity } from "@/lib/league-city/service";
import { leagueBuildings, scaleTownHeights } from "@/lib/league-city/buildings";
import { bounds } from "@/lib/league-city/grid";
import { faceRoad, freeLotsInOrder, lotKey } from "@/lib/league-city/placement";
import type { CityObject } from "@/lib/league-city/types";
import { createTelemetry } from "@/lib/league-city/drive/telemetry";
import { smashStoreFor } from "@/lib/league-city/smash";
import type { CrownApi } from "@/components/league/drive/CrownMode";
import type { Copy } from "./copy";

const LeagueScene = dynamic(() => import("@/components/league/LeagueScene"), {
  ssr: false,
  loading: () => null,
});

export interface PreviewTown {
  slug: string;
  city: LeagueCity;
  cityDevs: Record<string, unknown>[];
  norms: LayoutNorms;
}

// Filler developers for the empty lots, so the preview town is full. Ids are
// negative so they never meet a real developer.
function fillLots(
  objects: readonly CityObject[],
  h: number,
): { objects: CityObject[]; fake: Map<number, CityBuilding> } {
  const roads = new Set(objects.filter((o) => o.item_type === "road").map((o) => lotKey(o.x, o.z)));
  // Roads count as taken: freeLotsInOrder only skips occupied lots.
  const occupied = new Set(objects.map((o) => lotKey(o.x, o.z)));
  const free = freeLotsInOrder(occupied, roads, bounds(h));
  let seed = 20260930;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = [...objects];
  const fake = new Map<number, CityBuilding>();
  // Each building a bit narrower than its lot and low to mid height, so blocks
  // read as blocks and the brand stays in view.
  // Two lots in three, so the town has room to drive around.
  free
    .filter(() => rand() < 0.65)
    .forEach(([x, z], i) => {
      const id = -(i + 1);
      const width = 26 + Math.floor(rand() * 3) * 4;
      const depth = 26 + Math.floor(rand() * 3) * 4;
      const height = 20 + Math.floor(rand() * rand() * 7) * 12;
      out.push({
        id: `fill-${i}`,
        kind: "building",
        item_type: null,
        developer_id: id,
        x,
        z,
        px: null,
        pz: null,
        rot: faceRoad(roads, x, z),
        is_new: false,
      });
      fake.set(id, {
        login: `fill-${i}`,
        loginLower: `fill-${i}`,
        unlabeled: true,
        position: [0, 0, 0],
        width,
        depth,
        height,
        floors: Math.max(3, Math.floor(height / 6)),
        windowsPerFloor: Math.max(3, Math.floor(width / 5)),
        sideWindowsPerFloor: Math.max(3, Math.floor(depth / 5)),
        litPercentage: 0.3 + rand() * 0.6,
      } as unknown as CityBuilding);
    });
  return { objects: out, fake };
}

// A real town with the typed brand on its billboards, flags, hill sign, plane
// and blimp. It shows as a still town until the visitor presses Drive: only then
// the car (and its window-wide keyboard) loads, single-player and offline.
export default function TownBrandPreview({
  town,
  brand,
  t,
}: {
  town: PreviewTown;
  brand: string;
  t: Copy["formats"];
}) {
  // The car is always loaded; `active` is whether the keyboard drives it.
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const telemetry = useMemo(() => createTelemetry(), []);
  const crownApi = useRef<CrownApi | null>(null);

  // Rebuild the town's textures only once typing pauses.
  const [name, setName] = useState(brand);
  useEffect(() => {
    const id = setTimeout(() => setName(brand), 300);
    return () => clearTimeout(id);
  }, [brand]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (!entry.isIntersecting) setActive(false);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Esc or a click outside the stage hands the keyboard back to the page.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(false);
    const onDown = (e: PointerEvent) => {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) setActive(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [active]);

  const { objects, buildings } = useMemo(() => {
    const devs = town.cityDevs as unknown as DeveloperRecord[];
    const layout = generateCityLayout(devs, undefined, town.norms);
    const byLogin = new Map(layout.buildings.map((b) => [b.loginLower, b]));
    const byDevId = new Map<number, CityBuilding>();
    for (const d of devs) {
      const b = byLogin.get(d.github_login.toLowerCase());
      if (b) byDevId.set(d.id, b);
    }
    // The sky's plane and blimp carry the town's name unless they have their own text.
    const base = town.city.objects.map((o) =>
      o.item_type === "plane" || o.item_type === "blimp"
        ? { ...o, props: { ...(o.props ?? {}), text: undefined } }
        : o,
    );
    const filled = fillLots(base, town.city.h);
    for (const [id, b] of filled.fake) byDevId.set(id, b);
    return {
      objects: filled.objects,
      buildings: leagueBuildings(filled.objects, scaleTownHeights(byDevId)),
    };
  }, [town]);

  // Every building breaks under the car (DriveWorld offline); a fresh store per town.
  const smash = useMemo(() => ({ store: smashStoreFor(buildings), color: "#c8e64a" }), [buildings]);

  const identity = useMemo(
    () => ({
      ...town.city.identity,
      logoUrl: null,
      // Emerald, the main city's theme, so both previews read as one Git City.
      sky: 0,
      signSide: town.city.identity.signSide ?? "west",
    }),
    [town],
  );

  const drive = useMemo(
    () => ({
      offline: true,
      viewerDevId: null,
      telemetry,
      camera: "chase" as const,
      onCameraToggle: () => {},
      muted: !active,
      paused: !active,
      stallAt: null,
      onReady: () => setReady(true),
      onFail: () => setActive(false),
      slug: `preview-${town.slug}`,
      name: "guest",
      onDrivers: () => {},
      onHonk: () => {},
      crownApi,
      onCrown: () => {},
    }),
    [active, telemetry, town.slug],
  );

  return (
    <div
      ref={stageRef}
      role="region"
      aria-label={`${t.townLabel}: ${brand}`}
      className="relative aspect-[3/4] w-full overflow-hidden border-[3px] border-border bg-bg sm:aspect-[21/9]"
    >
      {visible && (
        <LeagueScene
          embedded
          h={town.city.h}
          identity={identity}
          name={name}
          objects={objects}
          buildings={buildings}
          mode={active ? "drive" : "view"}
          drive={active ? drive : undefined}
          interactive
          smash={smash}
          framing={{ zoom: 0.9, shiftPx: 0 }}
        />
      )}

      <span className="pointer-events-none absolute top-12 left-3 bg-bg/80 px-3 py-1.5 text-xs tracking-widest text-cream">
        {t.townLabel}
      </span>

      {!active ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setReady(false);
              setActive(true);
            }}
            className="btn-press pointer-events-auto border-[3px] border-lime bg-lime px-5 py-2.5 text-sm tracking-widest text-bg"
          >
            {t.drive}
          </button>
        </div>
      ) : (
        <span className="pointer-events-none absolute right-3 bottom-3 bg-bg/80 px-3 py-1.5 text-xs text-muted normal-case">
          {ready ? t.driveHint : t.loading}
        </span>
      )}
    </div>
  );
}
