"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { LeagueCity } from "@/lib/league-city/service";
import type { LayoutNorms } from "@/lib/github";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import { Avatar, fmt } from "@/components/league/hud/shared";
import { BATTLE_START, BATTLE_START_LABEL, timeUntil } from "@/lib/towns/rivalry";
import { useDesktop } from "./useDesktop";

const TownHero = dynamic(() => import("./TownHero"), { ssr: false });

export interface RivalSide {
  slug: string;
  name: string;
  color: string;
  cover: string | null;
  picked: number;
  /** Newest members first. */
  faces: { login: string; avatar_url: string | null }[];
  hero: { city: LeagueCity; cityDevs: Record<string, unknown>[]; cityNorms: LayoutNorms } | null;
}

type Pair = [RivalSide, RivalSide];

// /towns before the first battle week: Claude Code vs Codex, pick a side.
// The names are the headline; each town sits in its own window with its
// count and button on a solid bar, so no text ever sits on the sky.
export default function RivalryPoster({
  sides,
  mine,
  signedIn,
  pickOnLoad,
}: {
  sides: Pair;
  mine: 0 | 1 | null;
  signedIn: boolean;
  /** Back from sign-in with ?pick=<slug>: finish that pick. */
  pickOnLoad: string | null;
}) {
  const router = useRouter();
  const startsIn = useStartsIn();
  const [busy, setBusy] = useState<0 | 1 | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(i: 0 | 1) {
    const slug = sides[i].slug;
    setBusy(i);
    setError(null);
    if (!signedIn) {
      const params = new URLSearchParams({ next: `/towns?pick=${slug}` });
      await signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?${params.toString()}`);
      return;
    }
    try {
      const res = await fetch(`/api/leagues/${slug}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Something went wrong. Try again.");
      else router.refresh();
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(null);
  }

  // Finish the pick started before sign-in, once.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !pickOnLoad) return;
    resumed.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("pick");
    history.replaceState(null, "", url);
    const i = sides.findIndex((s) => s.slug === pickOnLoad);
    if (signedIn && mine === null && i !== -1) void pick(i as 0 | 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickOnLoad]);

  const total = sides[0].picked + sides[1].picked;
  const share = total === 0 ? 0.5 : sides[0].picked / total;

  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; City
        </Link>
      </nav>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-7 text-center sm:px-6 sm:pt-10">
          <p className="text-xs tracking-widest text-muted sm:text-sm">Git City Towns</p>
          <h1 className="mt-4 flex flex-col items-center gap-1 text-4xl leading-none sm:flex-row sm:justify-center sm:gap-5 sm:text-6xl">
            <span style={{ color: sides[0].color }}>{sides[0].name}</span>
            <span className="text-xl text-dim sm:text-3xl">vs</span>
            <span style={{ color: sides[1].color }}>{sides[1].name}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-cream normal-case sm:text-lg">
            {mine === null ? "Which side codes more? Pick yours." : `You're on ${sides[mine].name}. Bring your friends before ${BATTLE_START_LABEL}.`}
          </p>
          <p className="mt-5 inline-block border-[3px] border-border bg-bg-raised px-4 py-2 text-xs text-cream sm:text-sm">
            {startsIn === "" ? (
              "The battle is on"
            ) : (
              <>
                Battle starts {BATTLE_START_LABEL} · <span className="text-lime tabular-nums">{startsIn ?? "…"}</span>
              </>
            )}
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 sm:gap-6 sm:px-6">
          {sides.map((s, i) => (
            <SideCard key={s.slug} side={s} index={i as 0 | 1} mine={mine} busy={busy} onPick={pick} />
          ))}
        </div>
        {error && (
          <p role="alert" className="mx-auto mt-4 max-w-6xl px-4 text-center text-sm text-red-400 normal-case sm:px-6">
            {error}
          </p>
        )}

        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <div className="flex h-4" role="img" aria-label={leadLine(sides)}>
            <div className="h-full transition-[width] duration-700" style={{ width: `${share * 100}%`, background: sides[0].color }} />
            <div className="h-full w-[3px] bg-cream" />
            <div className="h-full flex-1" style={{ background: sides[1].color }} />
          </div>
          <p className="mt-3 text-center text-sm text-cream sm:text-base">{leadLine(sides)}</p>
        </div>
      </section>

      <WhoPicked sides={sides} />
    </main>
  );
}

/** Time to the first battle, ticking; null before the first client render (no hydration mismatch). */
function useStartsIn(): string | null {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setLeft(timeUntil(BATTLE_START, Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return left;
}

function leadLine(sides: Pair): string {
  const [a, b] = [sides[0].picked, sides[1].picked];
  if (a + b === 0) return "Nobody picked yet";
  if (a === b) return "Dead even";
  const lead = a > b ? sides[0] : sides[1];
  return `${Math.round((lead.picked / (a + b)) * 100)}% picked ${lead.name}`;
}

function SideCard({
  side,
  index,
  mine,
  busy,
  onPick,
}: {
  side: RivalSide;
  index: 0 | 1;
  mine: 0 | 1 | null;
  busy: 0 | 1 | null;
  onPick: (i: 0 | 1) => void;
}) {
  const yours = mine === index;
  return (
    <article className="flex flex-col border-[3px] bg-bg-card" style={{ borderColor: yours ? side.color : "var(--color-border)" }}>
      <div className="relative aspect-[4/5] overflow-hidden border-b-[3px] border-border sm:aspect-[2/1]">
        <TownView side={side} focus={index === 0 ? "60% 50%" : "40% 50%"} />
        {yours && (
          <span className="absolute top-2 left-2 px-2 py-1 text-[10px] text-bg sm:text-xs" style={{ background: side.color }}>
            &#10003; Your side
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-3 sm:flex-row sm:items-center sm:p-5">
        <div>
          <p className="text-3xl leading-none tabular-nums sm:text-5xl" style={{ color: side.color }}>
            {fmt(side.picked)}
          </p>
          <p className="mt-2 text-xs text-muted sm:text-sm">
            picked<span className="max-sm:hidden"> {side.name}</span>
          </p>
        </div>
        {yours ? (
          <Link href={`/town/${side.slug}?drive=1`} className="btn-press block px-4 py-3 text-center text-xs tracking-widest text-bg sm:text-sm" style={{ background: side.color }}>
            &#9654; Drive in
          </Link>
        ) : mine !== null ? (
          <Link href={`/town/${side.slug}`} className="btn-press block border-[3px] border-border px-4 py-2.5 text-center text-xs tracking-widest text-muted hover:text-cream sm:text-sm">
            Visit
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onPick(index)}
            disabled={busy !== null}
            className="btn-press block px-4 py-3 text-center text-xs tracking-widest text-bg disabled:opacity-60 sm:text-sm"
            style={{ background: side.color }}
          >
            {busy === index ? "Picking…" : (
              <>
                Pick <span className="max-sm:hidden">{side.name}</span>
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}

/** The town: live 3D on desktop, its photo on phones. */
function TownView({ side, focus }: { side: RivalSide; focus: string }) {
  const desktop = useDesktop();
  if (desktop && side.hero) return <TownHero city={side.hero.city} cityDevs={side.hero.cityDevs} cityNorms={side.hero.cityNorms} name={side.name} />;
  if (!side.cover) return <div className="absolute inset-0 bg-bg-raised" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={side.cover} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus }} />
  );
}

function WhoPicked({ sides }: { sides: Pair }) {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
      <h2 className="text-lg text-cream sm:text-xl">Who picked</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-6">
        {sides.map((side, s) => {
          const more = side.picked - side.faces.length;
          const align = s === 1 ? "text-right" : "";
          return (
            <div key={side.slug} className="border-[3px] border-border bg-bg-card p-3 sm:p-4" style={{ borderTopColor: side.color }}>
              <p className={`text-xs ${align}`} style={{ color: side.color }}>
                {side.name}
              </p>
              {side.faces.length === 0 ? (
                <p className={`mt-3 text-xs text-muted normal-case ${align}`}>Nobody yet</p>
              ) : (
                <div className={`mt-3 flex flex-wrap gap-1 ${s === 1 ? "justify-end" : ""}`}>
                  {side.faces.map((d) => (
                    <Link key={d.login} href={`/dev/${d.login}`} title={`@${d.login}`}>
                      <Avatar src={d.avatar_url} size={28} />
                    </Link>
                  ))}
                </div>
              )}
              {more > 0 && <p className={`mt-3 text-xs text-muted ${align}`}>+{fmt(more)} more</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

