// ─── Brasil town: the presidential election, server side ────
// Candidates and votes (brasil_candidates, brasil_votes, migration 173) for
// the term being run for (brasil-election.ts). Anyone on the map runs from
// the site; an admin can add someone (a famous dev who said yes), putting
// them on the map first when they aren't. A vote can change until the vote
// closes; the first one scores. The president is the winner of the term in
// office, read once per term (a closed vote never changes). Server only.

import { getSupabaseAdmin } from "../supabase";
import { captureServer } from "../posthog-server";
import { createDeveloperFromGitHub } from "../create-developer";
import { GitHubFetchError } from "../github-api";
import { invalidateLeague } from "../leagues/cache";
import { cantVote, electionClock, winner, type ElectionClock } from "./brasil-election";
import { awardPoints } from "./brasil-points-server";
import { placeBrasilResident } from "./brasil-server";
import type { UF } from "./brasil-map";

export interface Candidate {
  login: string;
  avatar_url: string | null;
  votes: number;
  addedBy: "self" | "admin";
}

export interface ElectionView {
  phase: ElectionClock["phase"];
  /** The term being run for, and its vote. */
  next: { n: number; opens: number; closes: number; start: number; end: number };
  /** The term in office. */
  current: { n: number; start: number; end: number } | null;
  president: { login: string; avatar_url: string | null } | null;
  /** Most votes first (sign-up order before the vote). */
  candidates: Candidate[];
  totalVotes: number;
  viewer: { login: string; onMap: boolean; running: boolean; votedFor: string | null; cantVote: string | null } | null;
}

interface CandidateRow {
  developer_id: number;
  added_by: "self" | "admin";
  created_at: string;
  developers: { github_login: string; avatar_url: string | null } | null;
}

async function standing(n: number): Promise<CandidateRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brasil_candidates")
    .select("developer_id, added_by, created_at, developers(github_login, avatar_url)")
    .eq("term", n)
    .is("withdrawn_at", null)
    .order("created_at", { ascending: true })
    .returns<CandidateRow[]>();
  if (error) throw new Error(`brasil candidates: ${error.message}`);
  return (data ?? []).filter((c) => c.developers);
}

async function votesOf(n: number): Promise<{ voter: number; candidate: number; at: number }[]> {
  const out: { voter: number; candidate: number; at: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabaseAdmin()
      .from("brasil_votes")
      .select("voter_id, candidate_id, voted_at")
      .eq("term", n)
      .order("voter_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`brasil votes: ${error.message}`);
    for (const v of (data ?? []) as { voter_id: number; candidate_id: number; voted_at: string }[]) out.push({ voter: v.voter_id, candidate: v.candidate_id, at: Date.parse(v.voted_at) });
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Each closed term's winner, once read. */
const elected = new Map<number, { login: string; avatar_url: string | null } | null>();

async function presidentOf(n: number): Promise<{ login: string; avatar_url: string | null } | null> {
  if (elected.has(n)) return elected.get(n)!;
  const [cands, votes] = await Promise.all([standing(n), votesOf(n)]);
  const id = winner(votes, new Set(cands.map((c) => c.developer_id)));
  const c = cands.find((x) => x.developer_id === id);
  const p = c?.developers ? { login: c.developers.github_login, avatar_url: c.developers.avatar_url } : null;
  elected.set(n, p);
  return p;
}

/** The president in office now (null before the first vote closes, or when nobody got a vote). */
export async function currentPresident(now = Date.now()): Promise<string | null> {
  const clock = electionClock(now);
  return clock.current ? ((await presidentOf(clock.current.n))?.login ?? null) : null;
}

async function isResident(leagueId: string, devId: number): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from("brasil_residents").select("developer_id").eq("league_id", leagueId).eq("developer_id", devId).maybeSingle();
  return !!data;
}

export async function getElection(leagueId: string, viewer: { id: number; github_login: string } | null, now = Date.now()): Promise<ElectionView> {
  const clock = electionClock(now);
  const n = clock.next.n;
  const [cands, votes, president] = await Promise.all([standing(n), votesOf(n), clock.current ? presidentOf(clock.current.n) : Promise.resolve(null)]);
  const ids = new Set(cands.map((c) => c.developer_id));
  const count = new Map<number, number>();
  for (const v of votes) if (ids.has(v.candidate)) count.set(v.candidate, (count.get(v.candidate) ?? 0) + 1);
  const candidates = cands
    .map((c) => ({ id: c.developer_id, login: c.developers!.github_login, avatar_url: c.developers!.avatar_url, votes: count.get(c.developer_id) ?? 0, addedBy: c.added_by }))
    .sort((a, b) => (clock.phase === "voting" ? b.votes - a.votes : 0));

  let v: ElectionView["viewer"] = null;
  if (viewer) {
    const onMap = await isResident(leagueId, viewer.id);
    const { data: dev } = await getSupabaseAdmin().from("developers").select("account_created_at").eq("id", viewer.id).maybeSingle<{ account_created_at: string | null }>();
    const mine = votes.find((x) => x.voter === viewer.id);
    v = {
      login: viewer.github_login,
      onMap,
      running: ids.has(viewer.id),
      votedFor: mine ? (candidates.find((c) => c.id === mine.candidate)?.login ?? null) : null,
      cantVote: cantVote({ onMap, accountCreated: dev?.account_created_at ? Date.parse(dev.account_created_at) : null, clock }),
    };
  }
  return {
    phase: clock.phase,
    next: { n, opens: clock.next.opens, closes: clock.next.closes, start: clock.next.start, end: clock.next.end },
    current: clock.current ? { n: clock.current.n, start: clock.current.start, end: clock.current.end } : null,
    president,
    candidates: candidates.map((c) => ({ login: c.login, avatar_url: c.avatar_url, votes: c.votes, addedBy: c.addedBy })),
    totalVotes: candidates.reduce((s, c) => s + c.votes, 0),
    viewer: v,
  };
}

/** Run for president (or stop running). */
export async function setRunning(leagueId: string, dev: { id: number; github_login: string }, running: boolean, addedBy: "self" | "admin" = "self"): Promise<string | null> {
  const n = electionClock(Date.now()).next.n;
  const sb = getSupabaseAdmin();
  if (!running) {
    await sb.from("brasil_candidates").update({ withdrawn_at: new Date().toISOString() }).eq("term", n).eq("developer_id", dev.id);
    return null;
  }
  if (!(await isResident(leagueId, dev.id))) return "Put your building on the map to run.";
  const { error } = await sb
    .from("brasil_candidates")
    .upsert({ term: n, developer_id: dev.id, added_by: addedBy, withdrawn_at: null }, { onConflict: "term,developer_id" });
  if (error) throw new Error(`brasil run: ${error.message}`);
  await captureServer(dev.github_login.toLowerCase(), "brasil_candidate_added", { term: n, by: addedBy });
  return null;
}

/** A vote (or a changed one) for a standing candidate; the first vote of a term scores. */
export async function castVote(leagueId: string, voter: { id: number; github_login: string }, candidateLogin: string): Promise<string | null> {
  const clock = electionClock(Date.now());
  const sb = getSupabaseAdmin();
  const onMap = await isResident(leagueId, voter.id);
  const { data: dev } = await sb.from("developers").select("account_created_at").eq("id", voter.id).maybeSingle<{ account_created_at: string | null }>();
  const why = cantVote({ onMap, accountCreated: dev?.account_created_at ? Date.parse(dev.account_created_at) : null, clock });
  if (why) return why;
  const n = clock.next.n;
  const cand = (await standing(n)).find((c) => c.developers!.github_login.toLowerCase() === candidateLogin.toLowerCase());
  if (!cand) return "That candidate isn't running.";
  const { error } = await sb
    .from("brasil_votes")
    .upsert({ term: n, voter_id: voter.id, candidate_id: cand.developer_id, voted_at: new Date().toISOString() }, { onConflict: "term,voter_id" });
  if (error) throw new Error(`brasil vote: ${error.message}`);
  await awardPoints(voter.id, "vote", `${n}:${voter.id}`);
  await captureServer(voter.github_login.toLowerCase(), "brasil_vote_cast", { term: n });
  return null;
}

/** Admin: put someone in the race, on the map first (in `uf`, or the island) when they aren't there. */
export async function adminAddCandidate(league: { id: string }, login: string, uf: UF | null): Promise<string | null> {
  const sb = getSupabaseAdmin();
  let { data: dev } = await sb.from("developers").select("id, github_login").eq("github_login", login).maybeSingle<{ id: number; github_login: string }>();
  if (!dev) {
    try {
      dev = await createDeveloperFromGitHub(login);
    } catch (err) {
      if (err instanceof GitHubFetchError) return `@${login} isn't on GitHub.`;
      throw err;
    }
  }
  if (!(await isResident(league.id, dev.id))) {
    await placeBrasilResident(league, { id: dev.id, login: dev.github_login }, uf, "admin");
    invalidateLeague(league.id);
  }
  return setRunning(league.id, dev, true, "admin");
}
