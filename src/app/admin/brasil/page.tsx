"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// The Brasil town's comments desk: the connected Instagram account and which
// of its reels count (their comments arrive by webhook, with a sync as the
// safety net); pasting comments by hand (one per line, "insta_user: the
// comment" or just the comment); the log of every comment imported and what
// came of it; and taking someone off the map.

interface CommentRow {
  id: string;
  reel: string;
  ig_user: string | null;
  github_login: string | null;
  uf: string | null;
  outcome: string;
  created_at: string;
}

interface Post {
  id: string;
  permalink: string;
  caption?: string;
  media_product_type: string;
  timestamp: string;
  /** What the post is watched for, or null. */
  watching: "brasil" | "city" | null;
}

interface Instagram {
  account: { username: string | null; refreshed_at: string; expires_at: string | null } | null;
  media: Post[];
  error?: string;
}

interface Result {
  line: string;
  outcome: string;
  login: string | null;
  uf: string | null;
}

const OUTCOME: Record<string, { label: string; tone: string }> = {
  added: { label: "On the map", tone: "text-lime" },
  already: { label: "Already there", tone: "text-cream" },
  unknown_user: { label: "Not on GitHub", tone: "text-red-400" },
  no_login: { label: "No username", tone: "text-muted" },
  blocked: { label: "Account already used", tone: "text-orange-300" },
  capped: { label: "Hourly cap", tone: "text-orange-300" },
};

export default function BrasilAdminPage() {
  const [log, setLog] = useState<{ comments: CommentRow[]; residents: number } | null>(null);
  const [reel, setReel] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [removeLogin, setRemoveLogin] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [ig, setIg] = useState<Instagram | null>(null);
  const [igNote, setIgNote] = useState<string | null>(null);
  const [igBusy, setIgBusy] = useState(false);

  const loadIg = useCallback(async () => {
    const res = await fetch("/api/admin/brasil?view=instagram", { cache: "no-store" });
    if (res.ok) setIg((await res.json()) as Instagram);
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/brasil?view=instagram", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j && setIg(j as Instagram))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const igAction = async (body: Record<string, unknown>, done: (json: Record<string, unknown>) => string) => {
    setIgBusy(true);
    try {
      const res = await fetch("/api/admin/brasil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as Record<string, unknown>;
      setIgNote(res.ok ? done(json) : String(json.error ?? "Failed."));
      await Promise.all([loadIg(), load()]);
    } finally {
      setIgBusy(false);
    }
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/brasil", { cache: "no-store" });
    if (res.ok) setLog((await res.json()) as { comments: CommentRow[]; residents: number });
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/brasil", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j && setLog(j as { comments: CommentRow[]; residents: number }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const importNow = async () => {
    setBusy(true);
    setResults(null);
    try {
      const res = await fetch("/api/admin/brasil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", reel, comments: text }) });
      const json = (await res.json()) as { results?: Result[]; error?: string };
      if (!res.ok) setNote(json.error ?? "Import failed.");
      setResults(json.results ?? []);
      setText("");
      await load();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const res = await fetch("/api/admin/brasil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", login: removeLogin }) });
    const json = (await res.json()) as { removed?: string; error?: string };
    setNote(res.ok ? `@${json.removed} is off the map.` : (json.error ?? "Couldn't remove."));
    setRemoveLogin("");
    await load();
  };

  const lines = text.split("\n").filter((l) => l.trim()).length;
  const input = "w-full border border-border bg-bg px-3 py-2 text-[12px] text-cream outline-none placeholder:text-dim focus:border-lime/50";

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header>
          <Link href="/admin" className="text-[11px] text-muted hover:text-cream">
            ← Admin
          </Link>
          <h1 className="mt-2 text-sm text-cream">Brasil town · comments</h1>
          <p className="mt-1 text-[11px] text-muted">
            {log ? `${log.residents.toLocaleString("en-US")} on the map` : "Loading…"} ·{" "}
            <Link href="/town/brasil-town" className="text-cream-dark hover:text-lime">
              open the map
            </Link>
          </p>
        </header>

        <section className="flex flex-col gap-3 border border-border bg-bg-raised p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-wider text-dim">Instagram</h2>
            <span className="text-[11px] text-muted">
              {!ig ? "Loading…" : ig.account ? `@${ig.account.username} · connected` : "Not connected"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={igBusy} onClick={() => igAction({ action: "connect" }, (j) => `Connected @${j.username}, comment webhooks on.`)} className="border border-border px-3 py-1.5 text-[11px] text-cream hover:border-lime hover:text-lime disabled:opacity-40">
              {ig?.account ? "Reconnect" : "Connect"}
            </button>
            <button type="button" disabled={igBusy || !ig?.account} onClick={() => igAction({ action: "sync" }, (j) => `Read ${j.reels} reel${j.reels === 1 ? "" : "s"}: ${j.fresh} new comment${j.fresh === 1 ? "" : "s"}.`)} className="border border-border px-3 py-1.5 text-[11px] text-cream hover:border-lime hover:text-lime disabled:opacity-40">
              {igBusy ? "Working…" : "Sync comments now"}
            </button>
          </div>
          {(igNote || ig?.error) && <p className="text-[11px] text-muted">{igNote ?? ig?.error}</p>}
          <p className="text-[11px] text-muted">Only comments on the posts set below count. City: a building in the city. Brasil: a building on the Brasil map.</p>
          <ul className="flex flex-col">
            {ig?.media.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-t border-border py-1.5 text-[11px]">
                <span className="flex shrink-0 gap-px border border-border">
                  {([null, "city", "brasil"] as const).map((k) => (
                    <button
                      key={k ?? "off"}
                      type="button"
                      disabled={igBusy || m.watching === k}
                      onClick={() =>
                        igAction({ action: "watch", mediaId: m.id, permalink: m.permalink, caption: m.caption ?? "", watching: k }, () =>
                          k === "city" ? "Comments on that post give a building in the city." : k === "brasil" ? "Comments on that post go on the Brasil map." : "Stopped watching that post.",
                        )
                      }
                      className={`px-2 py-0.5 text-[10px] ${m.watching === k ? "bg-lime text-bg" : "text-muted hover:text-cream"}`}
                    >
                      {k === null ? "Off" : k === "city" ? "City" : "Brasil"}
                    </button>
                  ))}
                </span>
                <span className="w-14 shrink-0 text-dim">{new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span className="w-10 shrink-0 text-dim">{m.media_product_type === "REELS" ? "Reel" : "Post"}</span>
                <a href={m.permalink} target="_blank" rel="noreferrer" className={`min-w-0 flex-1 truncate normal-case hover:text-lime ${m.watching ? "text-cream" : "text-muted"}`}>
                  {m.caption?.split("\n")[0] || m.permalink}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 border border-border bg-bg-raised p-4">
          <h2 className="text-[11px] uppercase tracking-wider text-dim">Paste comments</h2>
          <input value={reel} onChange={(e) => setReel(e.target.value)} placeholder="Reel URL (optional)" className={input} id="reel" />
          <textarea
            id="comments"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"One comment per line:\ninsta_user: @github-login SP\n@another-login Bahia"}
            className={`${input} font-mono`}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">{lines ? `${lines} comment${lines === 1 ? "" : "s"}` : "Up to 150 at a time"}</span>
            <button type="button" disabled={busy || !lines} onClick={importNow} className="border border-lime bg-lime px-4 py-2 text-[11px] text-bg disabled:opacity-40">
              {busy ? "Importing…" : "Put them on the map"}
            </button>
          </div>
          {results && (
            <ul className="flex flex-col gap-1 border-t border-border pt-3">
              {results.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[11px]">
                  <span className="min-w-0 truncate text-muted">{r.line}</span>
                  <span className={`shrink-0 ${OUTCOME[r.outcome]?.tone ?? "text-cream"}`}>
                    {[r.login && `@${r.login} ${r.uf ?? "island"}`, OUTCOME[r.outcome]?.label ?? r.outcome].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 border border-border bg-bg-raised p-4">
          <h2 className="text-[11px] uppercase tracking-wider text-dim">Take someone off the map</h2>
          <div className="flex gap-2">
            <input id="remove" value={removeLogin} onChange={(e) => setRemoveLogin(e.target.value)} placeholder="GitHub username" className={input} />
            <button type="button" disabled={!removeLogin.trim()} onClick={remove} className="shrink-0 border border-border px-4 text-[11px] text-cream hover:border-red-400 hover:text-red-400 disabled:opacity-40">
              Remove
            </button>
          </div>
          {note && <p className="text-[11px] text-muted">{note}</p>}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] uppercase tracking-wider text-dim">Latest comments</h2>
          {!log?.comments.length ? (
            <p className="text-[11px] text-muted">No comments imported yet.</p>
          ) : (
            <div className="overflow-x-auto border border-border">
              <table className="w-full text-left text-[11px]">
                <thead className="text-dim">
                  <tr>
                    <th className="px-3 py-2 font-normal">When</th>
                    <th className="px-3 py-2 font-normal">Instagram</th>
                    <th className="px-3 py-2 font-normal">GitHub</th>
                    <th className="px-3 py-2 font-normal">State</th>
                    <th className="px-3 py-2 font-normal">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {log.comments.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">{new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-3 py-1.5 text-muted">{c.ig_user ?? "–"}</td>
                      <td className="px-3 py-1.5 text-cream">{c.github_login ? `@${c.github_login}` : "–"}</td>
                      <td className="px-3 py-1.5 text-cream">{c.uf ?? (c.github_login ? "island" : "–")}</td>
                      <td className={`px-3 py-1.5 ${OUTCOME[c.outcome]?.tone ?? "text-cream"}`}>{OUTCOME[c.outcome]?.label ?? c.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
