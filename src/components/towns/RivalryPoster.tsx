"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { LeagueCity } from "@/lib/league-city/service";
import type { LayoutNorms } from "@/lib/github";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import { Avatar, fmt } from "@/components/league/hud/shared";
import { BATTLE_START, BATTLE_START_LABEL, timeUntil } from "@/lib/towns/rivalry";
import type { BattleState } from "@/lib/towns/battle";
import { resultLine } from "@/lib/towns/battle-sides";
import PresentedBy from "./PresentedBy";
import { SIDES } from "@/lib/towns/battle-rules";
import type { GridTown } from "@/lib/towns/discover";
import { GridTownCard } from "./TownCard";
import { useDesktop } from "./useDesktop";
import { LiveBadge, useTownsLive } from "./live";
import { sortByLive, type TownLive } from "@/lib/towns/live";

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

// /towns: Claude vs Codex. Before the first battle week, pick a side; from
// it on, the week's score (play points per player), the days won and the top
// players; all Monday, last week's final and who won it. The names are the
// headline; each town sits in its own window with its number and button on a
// solid bar, so no text ever sits on the sky.
export default function RivalryPoster({
  sides,
  mine,
  signedIn,
  login,
  battle,
  pickOnLoad,
  others,
  thisWeek,
}: {
  sides: Pair;
  /** Every other town, secondary, under the rivalry. */
  others: GridTown[];
  mine: 0 | 1 | null;
  signedIn: boolean;
  /** The viewer's login, for the invite link. */
  login: string | null;
  /** Null when it failed to load: the pick-phase poster still works. */
  battle: BattleState | null;
  /** Back from sign-in with ?pick=<slug>: finish that pick. */
  pickOnLoad: string | null;
  /** "This week" (how to score + top 10), rendered on the server; null when the board failed to load. */
  thisWeek: ReactNode;
}) {
  const router = useRouter();
  const b = battle?.phase === "live" ? battle : null;
  const startsIn = useCountdown(BATTLE_START);
  const endsIn = useCountdown(b ? Date.parse(`${b.current.end}T00:00:00Z`) : 0);
  const live = useTownsLive();
  const [busy, setBusy] = useState<0 | 1 | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(i: 0 | 1) {
    const slug = sides[i].slug;
    setBusy(i);
    setError(null);
    // /towns?ref=<login>: whoever shared the link gets the credit, through sign-in too.
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!signedIn) {
      const back = new URLSearchParams({ pick: slug, ...(ref ? { ref } : {}) });
      const params = new URLSearchParams({ next: `/towns?${back.toString()}` });
      await signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?${params.toString()}`);
      return;
    }
    try {
      const res = await fetch(`/api/leagues/${slug}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ref ? { ref } : {}) });
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
  const names: [string, string] = [sides[0].name, sides[1].name];
  const share = total === 0 ? 0.5 : sides[0].picked / total;
  const lead = leadLine(sides);
  const result = b?.showing === "result" ? resultLine(b.lastWeek, names) : null;

  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; City
        </Link>
        {others.length > 0 && (
          <a href="#other-towns" className="text-xs text-muted transition-colors hover:text-cream">
            Other towns &darr;
          </a>
        )}
      </nav>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-7 text-center sm:px-6 sm:pt-10">
          <p className="text-xs tracking-widest text-muted sm:text-sm">Git City Towns</p>
          <h1 className="mt-4 flex flex-col items-center gap-1 text-4xl leading-none sm:flex-row sm:justify-center sm:gap-5 sm:text-6xl">
            <span style={{ color: sides[0].color }}>{sides[0].name}</span>
            <span className="text-xl text-dim sm:text-3xl">vs</span>
            <span style={{ color: sides[1].color }}>{sides[1].name}</span>
          </h1>
          <PresentedBy className="mt-3" />
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-balance text-cream normal-case sm:text-lg">
            {result ??
              (mine === null
                ? "Which side plays more? Pick yours."
                : b
                  ? `You're on ${sides[mine].name}.`
                  : `You're on ${sides[mine].name}. Bring your friends before ${BATTLE_START_LABEL}.`)}
          </p>
          <p className="mt-5 inline-block border-[3px] border-border bg-bg-raised px-4 py-2 text-xs text-cream sm:text-sm">
            {b ? (
              <>
                {result && (
                  <>
                    <span className="whitespace-nowrap">
                      {sides[0].name} {b.series.claude} – {b.series.codex} {sides[1].name}
                    </span>
                    <span className="max-sm:hidden"> · </span>
                    <br className="sm:hidden" />
                  </>
                )}
                <span className="whitespace-nowrap">
                  Week {b.current.number} ends in <span className="text-lime tabular-nums">{endsIn ?? "…"}</span>
                </span>
              </>
            ) : startsIn === "" ? (
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
            <SideCard
              key={s.slug}
              side={s}
              index={i as 0 | 1}
              mine={mine}
              busy={busy}
              onPick={pick}
              live={live[s.slug] ?? null}
              login={login}
            />
          ))}
        </div>
        {error && (
          <p role="alert" className="mx-auto mt-4 max-w-6xl px-4 text-center text-sm text-red-400 normal-case sm:px-6">
            {error}
          </p>
        )}

        {!b && (
          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
            <div className="flex h-4" role="img" aria-label={lead}>
              <div className="h-full transition-[width] duration-700" style={{ width: `${share * 100}%`, background: sides[0].color }} />
              <div className="h-full w-[3px] bg-cream" />
              <div className="h-full flex-1" style={{ background: sides[1].color }} />
            </div>
            <p className="mt-3 text-center text-sm text-cream sm:text-base">{lead}</p>
          </div>
        )}
      </section>

      {thisWeek}
      {b ? <TopPlayers battle={b} sides={sides} /> : <WhoPicked sides={sides} />}
      <OtherTowns towns={sortByLive(others, live)} live={live} />
    </main>
  );
}

/** Time to `target`, ticking; null before the first client render (no hydration mismatch). */
function useCountdown(target: number): string | null {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setLeft(timeUntil(target, Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [target]);
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
  live,
  login,
}: {
  side: RivalSide;
  live: TownLive | null;
  login: string | null;
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
        <LiveBadge live={live} />
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
          <div className="flex flex-col gap-2">
            <Link href={`/town/${side.slug}`} className="btn-press block px-4 py-3 text-center text-xs tracking-widest text-bg sm:text-sm" style={{ background: side.color }}>
              Enter town
            </Link>
            {login && <InviteButton login={login} color={side.color} />}
          </div>
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

/** Copies /towns?ref=<login>: a pick from it credits the viewer (town_joined.ref). */
function InviteButton({ login, color }: { login: string; color: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}/towns?ref=${encodeURIComponent(login)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy your invite link", url);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="btn-press block border-[3px] px-4 py-2.5 text-center text-xs tracking-widest sm:text-sm"
      style={{ borderColor: color, color }}
    >
      {copied ? (
        "✓ Copied"
      ) : (
        <>
          <span className="sm:hidden">Invite</span>
          <span className="max-sm:hidden">Copy invite link</span>
        </>
      )}
    </button>
  );
}

function TopPlayers({ battle, sides }: { battle: BattleState; sides: Pair }) {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
      <h2 className="text-lg text-cream sm:text-xl">{battle.showing === "result" ? `Top players, week ${battle.week.number}` : "Top players this week"}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-6">
        {sides.map((side, s) => {
          const top = battle.sides[SIDES[s]].top;
          const right = s === 1;
          return (
            <div key={side.slug} className="border-[3px] border-border bg-bg-card p-3 sm:p-4" style={{ borderTopColor: side.color }}>
              <p className={`text-xs ${right ? "text-right" : ""}`} style={{ color: side.color }}>
                {side.name}
              </p>
              {top.length === 0 ? (
                <p className={`mt-3 text-xs text-muted normal-case ${right ? "text-right" : ""}`}>Nobody scored yet</p>
              ) : (
                <ol className="mt-3 flex flex-col gap-2">
                  {top.map((c, r) => (
                    <li key={c.login} className={`flex items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
                      <span className="w-3 shrink-0 text-xs text-dim tabular-nums">{r + 1}</span>
                      <Link href={`/dev/${c.login}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-cream" style={{ flexDirection: right ? "row-reverse" : "row" }}>
                        <Avatar src={c.avatar_url} size={24} />
                        <span className="min-w-0 truncate text-xs text-cream normal-case">@{c.login}</span>
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums" style={{ color: side.color }}>
                        {fmt(c.total)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
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

function OtherTowns({ towns, live }: { towns: GridTown[]; live: Record<string, TownLive> }) {
  return (
    <section id="other-towns" className="mx-auto mt-20 max-w-6xl scroll-mt-6 px-4 sm:px-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base text-cream sm:text-lg">Other towns</h2>
          <p className="mt-1 text-xs text-muted normal-case">Every town also races for the monument in the center of Git City.</p>
        </div>
        <Link href="/towns/new" className="btn-press shrink-0 border-[3px] border-border px-3 py-2 text-xs text-muted hover:border-lime hover:text-lime">
          + Create a town
        </Link>
      </div>
      {towns.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {towns.map((t) => (
            <GridTownCard key={t.slug} town={t} live={live[t.slug]} />
          ))}
        </div>
      )}
    </section>
  );
}
