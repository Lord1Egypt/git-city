"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import Panel from "@/components/league/hud/Panel";
import { Avatar, fmt } from "@/components/league/hud/shared";
import type { ElectionView } from "@/lib/towns/brasil-election-server";

// The presidential race: who's in office, who's running for the next term,
// the live count while the vote is open, and the viewer's way in (run, vote,
// change their vote). Times are Brasília's.

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

export default function ElectionPanel({
  slug,
  initial,
  signedIn,
  onSignIn,
  onPickDev,
  onPutOnMap,
  onClose,
}: {
  slug: string;
  initial: ElectionView;
  signedIn: boolean;
  onSignIn: () => void;
  onPickDev: (login: string) => void;
  onPutOnMap: () => void;
  onClose: () => void;
}) {
  const [e, setE] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The count moves while the vote is open: read it again every half minute.
  useEffect(() => {
    if (e.phase !== "voting") return;
    const id = setInterval(() => {
      fetch(`/api/towns/${slug}/brasil/election`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((x: ElectionView | null) => x && setE(x))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [e.phase, slug]);

  const act = async (body: Record<string, string>) => {
    setBusy(body.candidate ?? body.action);
    setError(null);
    try {
      const res = await fetch(`/api/towns/${slug}/brasil/election`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Try again.");
      setE(json as ElectionView);
      posthog.capture(body.action === "vote" ? "brasil_vote_clicked" : "brasil_run_clicked", { action: body.action });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const voting = e.phase === "voting";
  const me = e.viewer;
  const max = Math.max(1, ...e.candidates.map((c) => c.votes));

  return (
    <Panel title="President" onClose={onClose}>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {/* In office */}
        <div className="border-2 border-lime px-3 py-2">
          {e.president ? (
            <button type="button" onClick={() => onPickDev(e.president!.login)} className="flex w-full items-center gap-2.5 text-left">
              <Avatar src={e.president.avatar_url} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] text-lime">President of Brazil</span>
                <span className="block truncate text-[11px] normal-case text-cream">@{e.president.login}</span>
              </span>
              {e.current && <span className="text-[9px] text-muted">until {day(e.current.end)}</span>}
            </button>
          ) : (
            <p className="text-[10px] normal-case text-muted">
              <span className="uppercase text-lime">No president yet.</span> The first one is voted in on {day(e.next.closes)}.
            </p>
          )}
        </div>

        {/* The race */}
        <div>
          <p className="mb-1.5 text-[10px] text-cream">{voting ? "Vote open" : `Running for term ${e.next.n}`}</p>
          <p className="mb-2 text-[9px] normal-case text-muted">
            {voting
              ? `Closes ${when(e.next.closes)} (Brasília). One vote each, change it until then.`
              : `Vote opens ${when(e.next.opens)}, closes ${when(e.next.closes)} (Brasília). Anyone on the map can run.`}
          </p>
          {e.candidates.length === 0 ? (
            <p className="border-2 border-border px-3 py-2 text-[10px] normal-case text-muted">Nobody is running yet. Be the first.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {e.candidates.map((c) => {
                const mine = me?.votedFor?.toLowerCase() === c.login.toLowerCase();
                return (
                  <li key={c.login} className={`flex items-center gap-2.5 border-2 px-2 py-1.5 ${mine ? "border-lime" : "border-border"}`}>
                    <button type="button" onClick={() => onPickDev(c.login)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <Avatar src={c.avatar_url} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] normal-case text-cream hover:text-lime">@{c.login}</span>
                        {voting && (
                          <span className="mt-1 block h-1 bg-border">
                            <span className="block h-1 bg-lime" style={{ width: `${(c.votes / max) * 100}%` }} />
                          </span>
                        )}
                      </span>
                    </button>
                    {voting && <span className="w-8 text-right text-[10px] tabular-nums text-cream">{fmt(c.votes)}</span>}
                    {voting && me && !me.cantVote && (
                      <button
                        type="button"
                        disabled={mine || busy !== null}
                        onClick={() => act({ action: "vote", candidate: c.login })}
                        className={`w-16 shrink-0 py-1 text-center text-[9px] ${mine ? "text-lime" : "bg-lime text-bg disabled:opacity-40"}`}
                      >
                        {mine ? "Your vote" : busy === c.login ? "…" : "Vote"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {voting && e.totalVotes > 0 && <p className="mt-1.5 text-[9px] normal-case text-muted">{fmt(e.totalVotes)} votes so far</p>}
        </div>

        {/* Your way in */}
        <div className="flex flex-col gap-2 border-t-2 border-border pt-3">
          {!signedIn ? (
            <>
              <p className="text-[10px] normal-case text-muted">Sign in with GitHub to run or vote.</p>
              <button type="button" onClick={onSignIn} className="btn-press border-2 border-lime bg-lime py-2 text-[11px] text-bg">
                Sign in with GitHub
              </button>
            </>
          ) : !me?.onMap ? (
            <>
              <p className="text-[10px] normal-case text-muted">Only devs on the map run and vote.</p>
              <button type="button" onClick={onPutOnMap} className="btn-press border-2 border-lime bg-lime py-2 text-[11px] text-bg">
                Put my building on the map
              </button>
            </>
          ) : (
            <>
              {voting && me.cantVote && <p className="text-[10px] normal-case text-muted">{me.cantVote}</p>}
              {voting && !me.cantVote && !me.votedFor && e.candidates.length > 0 && <p className="text-[10px] normal-case text-muted">Your first vote is worth 10 points for your state.</p>}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act({ action: me.running ? "withdraw" : "run" })}
                className={`btn-press border-2 py-2 text-[11px] disabled:opacity-40 ${me.running ? "border-border text-muted hover:text-cream" : "border-lime bg-lime text-bg"}`}
              >
                {me.running ? "Stop running" : "Run for president"}
              </button>
              {me.running && <p className="text-[10px] normal-case text-muted">You&apos;re running. Campaign on Instagram: tag your friends and get them on the map to vote.</p>}
            </>
          )}
          {error && <p className="text-[10px] normal-case text-red-400">{error}</p>}
        </div>
      </div>
    </Panel>
  );
}
