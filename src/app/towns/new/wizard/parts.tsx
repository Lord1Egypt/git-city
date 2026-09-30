"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { generateCityLayout, type CityBuilding, type DeveloperRecord, type LayoutNorms } from "@/lib/github";
import { leagueBuildings, scaleTownHeights } from "@/lib/league-city/buildings";
import { starterObjects, starterOps } from "@/lib/league-city/starter";
import { LOT, bounds } from "@/lib/league-city/grid";
import type { TemplateId } from "@/lib/league-city/templates";
import type { CityIdentity } from "@/lib/league-city/types";

const LeagueScene = dynamic(() => import("@/components/league/LeagueScene"), { ssr: false, loading: () => null });

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-xs tracking-widest text-muted">{label}</p>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 text-xs text-dim normal-case">{hint}</p>}
    </div>
  );
}

/** The town's logo tile, or its initial until there's a logo. */
export function LogoTile({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- local pixel preview (data URL)
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 border-[3px] border-border bg-bg"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center border-[3px] border-border bg-bg text-lime"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

function useCopied(): [boolean, (text: string) => void] {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(id);
  }, [done]);
  return [
    done,
    (text) => {
      void navigator.clipboard?.writeText(text).catch(() => {});
      setDone(true);
    },
  ];
}

/** One line of text with a Copy button on its right. */
export function CopyRow({ text, shown, copy, copied }: { text: string; shown: string; copy: string; copied: string }) {
  const [done, doCopy] = useCopied();
  return (
    <div className="flex min-w-0 items-stretch border-[3px] border-border bg-bg">
      <span className="flex min-w-0 flex-1 items-center px-3 py-2.5 text-sm text-cream normal-case">
        <span className="truncate">{shown}</span>
      </span>
      <button
        type="button"
        onClick={() => doCopy(text)}
        className={`btn-press min-h-10 border-l-[3px] border-border px-4 text-xs tracking-widest ${done ? "text-lime" : "text-muted hover:text-cream"}`}
      >
        {done ? `✓ ${copied}` : copy}
      </button>
    </div>
  );
}

/** A block of text with a full-width Copy bar under it. */
export function CopyBlock({ text, lang, copy, copied }: { text: string; lang: string; copy: string; copied: string }) {
  const [done, doCopy] = useCopied();
  return (
    <div className="border-[3px] border-border bg-bg-card">
      <p lang={lang} className="p-4 text-sm leading-relaxed text-cream normal-case">
        {text}
      </p>
      <button
        type="button"
        onClick={() => doCopy(text)}
        className={`btn-press block w-full border-t-[3px] px-4 py-3 text-xs tracking-widest transition-colors ${
          done ? "border-lime bg-lime text-bg" : "border-border text-cream hover:bg-bg-raised"
        }`}
      >
        {done ? `✓ ${copied}` : copy}
      </button>
    </div>
  );
}

export function GithubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const MINI_LOT = 3;

/** The template's starter city from above, one pixel block per lot. */
export function MiniMap({ id, on }: { id: TemplateId; on: boolean }) {
  const cells = useMemo(() => {
    const city = starterOps([], id);
    return { h: city.h, objects: starterObjects(city) };
  }, [id]);
  const b = bounds(cells.h);
  const w = (b.x1 - b.x0 + 1) * MINI_LOT;
  const d = (b.z1 - b.z0 + 1) * MINI_LOT;
  const at = (x: number, z: number) => [(x - b.x0) * MINI_LOT, (z - b.z0) * MINI_LOT] as const;
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${d}`} width={48} height={Math.round((48 * d) / w)} shapeRendering="crispEdges" className="shrink-0">
      <rect width={w} height={d} fill={on ? "#1c2a14" : "#1a1f2a"} />
      {cells.objects.map((o) => {
        if (o.px === null) {
          if (o.kind !== "item") return null;
          const [x, y] = at(o.x, o.z);
          return (
            <rect key={o.id} x={x} y={y} width={MINI_LOT} height={MINI_LOT} fill={o.item_type === "road" ? (on ? "#c8e64a" : "#9aa3b5") : "#5d6478"} />
          );
        }
        if (!o.item_type || o.item_type === "portal" || o.item_type === "lamp" || o.item_type === "bench") return null;
        const [x, y] = at(o.px / LOT, (o.pz ?? 0) / LOT);
        const tree = o.item_type.startsWith("tree_");
        return (
          <rect key={o.id} x={x + 0.5} y={y + 0.5} width={2} height={2} fill={tree ? "#3f9a4a" : o.item_type === "fountain" ? "#5ab0e0" : "#ff9a3c"} />
        );
      })}
    </svg>
  );
}

/** The picked starter city, live, with the viewer's own building and the town's name and logo. */
export function CityPreview({
  template,
  name,
  logo,
  viewerId,
  cityDevs,
  cityNorms,
  caption,
  push,
}: {
  template: TemplateId;
  name: string;
  logo: string | null;
  viewerId: number | null;
  cityDevs: Record<string, unknown>[];
  cityNorms: LayoutNorms;
  caption: string;
  push: boolean;
}) {
  const city = useMemo(() => {
    const st = starterOps(viewerId ? [{ developer_id: viewerId, weight: 0 }] : [], template);
    return { h: st.h, objects: starterObjects(st) };
  }, [template, viewerId]);
  const byDevId = useMemo(() => {
    const devs = cityDevs as unknown as DeveloperRecord[];
    const layout = generateCityLayout(devs, undefined, cityNorms);
    const byLogin = new Map(layout.buildings.map((b) => [b.loginLower, b]));
    const map = new Map<number, CityBuilding>();
    for (const d of devs) {
      const b = byLogin.get(d.github_login.toLowerCase());
      if (b) map.set(d.id, b);
    }
    return scaleTownHeights(map);
  }, [cityDevs, cityNorms]);
  const buildings = useMemo(() => leagueBuildings(city.objects, byDevId), [city.objects, byDevId]);
  const identity: CityIdentity = useMemo(
    () => ({ sky: 1, signSide: null, logoUrl: logo, logoRemoved: false, identityVersion: logo ? 1 : 0 }),
    [logo],
  );
  return (
    <article className="border-[3px] border-border bg-bg-card">
      <div className="relative aspect-[16/11] overflow-hidden border-b-[3px] border-border bg-bg-raised">
        <LeagueScene
          embedded
          h={city.h}
          identity={identity}
          name={name}
          objects={city.objects}
          buildings={buildings}
          mode="view"
          riseKey={template}
          push={push}
          framing={{ zoom: 1.2, shiftPx: 0 }}
        />
      </div>
      <div className="flex items-center gap-3 p-4">
        <LogoTile src={logo} name={name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-xl leading-none text-cream sm:text-2xl">{name}</p>
          <p className="mt-2 text-xs text-muted">{caption}</p>
        </div>
      </div>
    </article>
  );
}
