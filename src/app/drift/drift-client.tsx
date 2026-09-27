"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Backdrop, Band, Chip } from "@/components/drift/ui";
import { MEDAL_COLORS, fmt } from "@/components/drift/DriftHud";
import type { BoardRowLite } from "@/components/drift/DriftTitle";
import { loadRun } from "@/lib/drift/local";
import { SPOTS } from "@/lib/drift/spots";
import { medalFor, medalScores, type LiveSpot, type SpotId } from "@/lib/drift/spots/types";

// The drift spots, in broadcast bands over the chosen spot's photo, blurred:
// the list on the left (live spots first, the ones to come locked), the
// chosen spot's board on the right (the world or your country, your own row
// pinned even far down, any row a ghost to race). ↑↓ choose a spot, ←→ switch
// the board, Enter drifts.

export interface SpotBoard {
  rows: BoardRowLite[];
  total: number;
  me: BoardRowLite | null;
}

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });
const T = { hero: "clamp(52px, 11vh, 128px)", big: "clamp(18px, 2.8vh, 30px)", body: "clamp(12px, 1.8vh, 19px)", small: "clamp(10px, 1.4vh, 15px)" };
const COUNTRIES = ["AR", "AU", "BR", "CA", "CL", "CN", "CO", "DE", "ES", "FR", "GB", "ID", "IN", "IT", "JP", "KR", "MX", "NG", "NL", "PH", "PL", "PT", "RU", "SE", "TR", "UA", "US", "VN"];

export default function DriftClient({
  boards,
  viewerLogin,
  country: initialCountry,
  initial,
}: {
  boards: Record<string, SpotBoard>;
  viewerLogin: string | null;
  country: string | null;
  initial: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState(Math.max(0, SPOTS.findIndex((s) => s.id === initial)));
  const [tab, setTab] = useState<"world" | "country">("world");
  const [country, setCountry] = useState(initialCountry);
  const [countryBoards, setCountryBoards] = useState<Record<string, SpotBoard>>({});
  const [local, setLocal] = useState<Record<string, number>>({});
  useEffect(() => {
    const read = () => {
      const out: Record<string, number> = {};
      for (const s of SPOTS) {
        const r = s.status === "live" ? loadRun(s.id) : null;
        if (r) out[s.id] = r.score;
      }
      setLocal(out);
    };
    read();
  }, []);

  const spot = SPOTS[sel];
  const live = spot.status === "live" ? (spot as LiveSpot) : null;
  const bestOf = useCallback(
    (id: SpotId) => {
      const b = boards[id]?.me?.score ?? null;
      const l = local[id] ?? null;
      return b === null ? l : l === null ? b : Math.max(b, l);
    },
    [boards, local],
  );

  // The country board, fetched the first time it's shown.
  useEffect(() => {
    if (tab !== "country" || !live || !country) return;
    const key = `${live.id}:${country}`;
    if (countryBoards[key]) return;
    let on = true;
    fetch(`/api/drift/${live.id}/board?scope=${country}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ rows: BoardRowLite[]; total: number; me: BoardRowLite | null }>) : null))
      .then((b) => {
        if (on && b) setCountryBoards((m) => ({ ...m, [key]: { rows: b.rows.slice(0, 10), total: b.total, me: b.me } }));
      })
      .catch(() => {
        // offline: the tab stays empty
      });
    return () => {
      on = false;
    };
  }, [tab, live, country, countryBoards]);

  const board: SpotBoard | null = live ? (tab === "world" ? boards[live.id] : country ? countryBoards[`${live.id}:${country}`] ?? null : null) : null;

  const go = useCallback((login?: string) => {
    const s = SPOTS[sel];
    if (s.status !== "live") return;
    router.push(login ? `/drift/${s.id}?ghost=${encodeURIComponent(login)}` : `/drift/${s.id}`);
  }, [router, sel]);

  const pickCountry = useCallback(
    (cc: string) => {
      setCountry(cc);
      setTab("country");
      if (viewerLogin) {
        void fetch("/api/drift/country", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: cc }) });
      }
    },
    [viewerLogin],
  );

  const keys = useRef({ go, sel });
  useEffect(() => {
    keys.current = { go, sel };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.target as HTMLElement | null)?.tagName === "SELECT") return;
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        setSel((i) => (i + 1) % SPOTS.length);
      } else if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        setSel((i) => (i - 1 + SPOTS.length) % SPOTS.length);
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") setTab("world");
      else if (e.code === "ArrowRight" || e.code === "KeyD") setTab("country");
      else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        keys.current.go();
      } else if (e.key === "Escape") router.push("/towns");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const medals = useMemo(() => (live ? medalScores(live) : []), [live]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg font-pixel uppercase text-cream">
      {live && (
        // eslint-disable-next-line @next/next/no-img-element -- a local still, blurred behind the bands
        <img key={live.id} src={`/drift/${live.id}.jpg`} alt="" className="absolute inset-0 h-full w-full scale-105 animate-[drift-blur-in_0.4s_ease-out_both] object-cover" />
      )}
      <Backdrop side="left" />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[1500px] flex-col gap-10 px-[5vw] py-[5vh] lg:flex-row lg:items-center lg:justify-between">
          {/* The spots */}
          <section className="flex flex-col items-start gap-6">
            <Link href="/towns" className="text-muted hover:text-cream" style={{ fontSize: T.small }}>
              ← Towns
            </Link>
            <div className="flex flex-col items-start">
              <Band tone="lime" className="px-6 pb-3 pt-4 leading-none tracking-[0.06em]" style={{ fontSize: T.hero }}>
                Drift
              </Band>
              <Band delay={70} className="px-4 py-2.5 normal-case" style={{ fontSize: T.body }}>
                Spots outside every town. One board for everyone.
              </Band>
            </div>
            <div role="listbox" aria-label="Drift spots" className="flex w-[min(560px,90vw)] flex-col">
              {SPOTS.map((s, i) => {
                const on = i === sel;
                const best = s.status === "live" ? bestOf(s.id) : null;
                const medal = s.status === "live" ? medalFor(s as LiveSpot, best) : null;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => (on ? go() : setSel(i))}
                    onMouseEnter={() => setSel(i)}
                    className={`drift-band flex items-center gap-5 px-5 py-3.5 text-left shadow-[0_6px_0_rgba(0,0,0,0.35)] outline-none ${on ? "bg-cream text-bg" : "bg-[#141417] text-cream"} ${s.status === "soon" && !on ? "text-muted" : ""}`}
                    style={{ animationDelay: `${140 + i * 50}ms`, fontSize: T.body }}
                  >
                    <span className={`w-3 ${on ? "" : "opacity-0"}`}>▶</span>
                    <span className="w-6 tabular-nums opacity-60">{i + 1}</span>
                    <span className="flex-1">{s.name}</span>
                    {s.status === "soon" ? (
                      <span className="opacity-60" style={{ fontSize: T.small }}>
                        Soon
                      </span>
                    ) : (
                      <span className="flex items-baseline gap-3 tabular-nums">
                        {medal && (
                          <span style={{ color: on ? undefined : MEDAL_COLORS[medal], fontSize: T.small }} className={on ? "opacity-70" : ""}>
                            {medal}
                          </span>
                        )}
                        <span>{best !== null ? fmt(best) : "-"}</span>
                      </span>
                    )}
                  </button>
                );
              })}
              <Band delay={480} className="justify-center gap-3 px-5 py-2 text-muted" style={{ fontSize: T.small }}>
                <Chip>↑</Chip>
                <Chip>↓</Chip> spot <Chip>←</Chip>
                <Chip>→</Chip> board <Chip>Enter</Chip> drift
              </Band>
            </div>
          </section>

          {/* The chosen spot */}
          <section key={spot.id} className="flex w-[min(620px,90vw)] flex-col items-stretch">
            <Band className="justify-between px-5 py-2.5" style={{ fontSize: T.small }}>
              <span className="text-lime">{spot.name}</span>
              <span className="text-muted">{live ? `${fmt(boards[live.id]?.total ?? 0)} drivers` : "Opens soon"}</span>
            </Band>
            <Band delay={50} className="px-5 py-3 normal-case" style={{ fontSize: T.body }}>
              {spot.tagline}
            </Band>
            {live && (
              <>
                <Band delay={100} className="flex-wrap gap-x-6 gap-y-1 px-5 py-2.5">
                  {medals.map(([m, at]) => (
                    <span key={m} className="flex items-baseline gap-2">
                      <span style={{ color: MEDAL_COLORS[m], fontSize: T.small }}>{m}</span>
                      <span className="tabular-nums" style={{ fontSize: T.small }}>
                        {fmt(at)}
                      </span>
                    </span>
                  ))}
                </Band>

                <div className="mt-5 flex items-stretch" style={{ fontSize: T.small }}>
                  <button type="button" onClick={() => setTab("world")} className={`drift-band px-5 py-2.5 shadow-[0_6px_0_rgba(0,0,0,0.35)] ${tab === "world" ? "bg-lime text-bg" : "bg-[#141417] text-cream hover:text-lime"}`} style={{ animationDelay: "150ms" }}>
                    World
                  </button>
                  <button type="button" onClick={() => setTab("country")} className={`drift-band px-5 py-2.5 shadow-[0_6px_0_rgba(0,0,0,0.35)] ${tab === "country" ? "bg-lime text-bg" : "bg-[#141417] text-cream hover:text-lime"}`} style={{ animationDelay: "180ms" }}>
                    {country ? COUNTRY.of(country) ?? country : "Country"}
                  </button>
                  <label className="drift-band ml-auto flex items-center gap-2 bg-[#141417] px-4 text-muted shadow-[0_6px_0_rgba(0,0,0,0.35)]" style={{ animationDelay: "210ms" }}>
                    <span className="sr-only">Your country</span>
                    <select
                      id="drift-country"
                      value={country ?? ""}
                      onChange={(e) => e.target.value && pickCountry(e.target.value)}
                      className="cursor-pointer bg-transparent uppercase text-cream outline-none"
                    >
                      <option value="" disabled>
                        Pick country
                      </option>
                      {[...new Set([...(country ? [country] : []), ...COUNTRIES])].map((cc) => (
                        <option key={cc} value={cc} className="bg-bg">
                          {COUNTRY.of(cc) ?? cc}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 flex flex-col">
                  {!board && tab === "country" && (
                    <Band className="px-5 py-3 text-muted" style={{ fontSize: T.body }}>
                      {country ? "Loading…" : "Pick your country to see its board"}
                    </Band>
                  )}
                  {board && board.rows.length === 0 && (
                    <Band className="px-5 py-3 text-muted" style={{ fontSize: T.body }}>
                      Nobody yet. Be first.
                    </Band>
                  )}
                  {board?.rows.map((r, i) => {
                    const mine = !!viewerLogin && r.login.toLowerCase() === viewerLogin.toLowerCase();
                    return (
                      <button
                        key={`${r.rank}-${r.login}`}
                        type="button"
                        onClick={() => go(r.login)}
                        title={`Race @${r.login}'s ghost`}
                        className={`drift-band group flex items-center justify-between gap-4 px-5 py-2 text-left tabular-nums shadow-[0_6px_0_rgba(0,0,0,0.35)] ${mine ? "bg-lime text-bg" : "bg-[#141417] text-cream hover:text-lime"}`}
                        style={{ animationDelay: `${220 + i * 40}ms`, fontSize: T.small }}
                      >
                        <span className="flex gap-5">
                          <span className={`w-6 ${mine ? "" : "text-muted"}`}>{r.rank}</span>
                          <span className="normal-case">@{r.login}</span>
                        </span>
                        <span className="flex gap-4">
                          <span className="opacity-0 group-hover:opacity-100">Race ghost</span>
                          <span>{fmt(r.score)}</span>
                        </span>
                      </button>
                    );
                  })}
                  {board?.me && !board.rows.some((r) => r.login.toLowerCase() === board.me!.login.toLowerCase()) && (
                    <Band tone="lime" className="mt-2 justify-between gap-4 px-5 py-2.5 tabular-nums" style={{ fontSize: T.body }}>
                      <span className="flex gap-5">
                        <span>{board.me.rank}</span>
                        <span className="normal-case">@{board.me.login}</span>
                      </span>
                      <span>{fmt(board.me.score)}</span>
                    </Band>
                  )}
                </div>

                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={() => go()} className="drift-band flex items-center gap-3 bg-cream px-7 py-4 text-bg shadow-[0_6px_0_rgba(0,0,0,0.35)] outline-none hover:bg-lime focus-visible:bg-lime" style={{ fontSize: T.big, animationDelay: "320ms" }}>
                    <Chip tone="dark">Enter</Chip> Drift {spot.name}
                  </button>
                </div>
              </>
            )}
            {!live && (
              <Band delay={100} className="px-5 py-3 text-muted" style={{ fontSize: T.body }}>
                A new spot opens every week or two. Harbor and Touge are open now.
              </Band>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
