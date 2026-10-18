// ─── Brasil town: server side ───────────────────────────────
// Residents are stored with their lot (brasil_residents, migration 169), so
// the map is the same for everyone and nobody's building moves. Placing a
// resident reads everyone already placed, asks the placer (brasil-map.ts)
// for the next lot of their state's city and stores it; two arrivals at the
// same instant can't share a lot (the table's unique key), so the loser
// re-reads and tries again. A resident is also an active member of the
// town, so every town feature (standings, smash, the drive room) sees them.
// Server only.

import { getSupabaseAdmin } from "../supabase";
import { invalidateLeague } from "../leagues/cache";
import type { League } from "../leagues/service";
import { createDeveloperFromGitHub } from "../create-developer";
import { GitHubFetchError } from "../github-api";
import { BrasilPlacer, STATES, layoutFromResidents, ptState, type BrasilLayout, type MapDev, type Resident, type UF } from "./brasil-map";
import { parseComment } from "./brasil-comments";
import { weekStart } from "../leagues/scoring";
import { loadLeagueStandings } from "../leagues/standings";
import { CAPITALS, ISLAND, SECOND_CITIES } from "./brasil-geo";
import { sendBrasilMapNotification } from "../notification-senders/brasil-map";

export const BRASIL_SLUG = "brasil-town";

export type ResidentSource = "site" | "instagram" | "admin";

interface ResidentRow {
  developer_id: number;
  uf: string | null;
  hub: number;
  x: number;
  z: number;
  placed_at: string;
  developers: { github_login: string } | null;
}

/** Everyone on the map, in the order they arrived. */
export async function getBrasilResidents(leagueId: string): Promise<Resident[]> {
  const sb = getSupabaseAdmin();
  const out: Resident[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("brasil_residents")
      .select("developer_id, uf, hub, x, z, placed_at, developers(github_login)")
      .eq("league_id", leagueId)
      .order("placed_at", { ascending: true })
      .range(from, from + 999)
      .returns<ResidentRow[]>();
    if (error) throw new Error(`brasil residents: ${error.message}`);
    for (const r of data ?? []) {
      const login = r.developers?.github_login;
      if (!login) continue;
      out.push({ dev: { id: r.developer_id, login, uf: (r.uf as UF | null) ?? null }, x: r.x, z: r.z, hub: r.hub, at: Date.parse(r.placed_at) });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** The whole map from what's stored. */
export async function getBrasilLayout(leagueId: string): Promise<{ layout: BrasilLayout; residents: Resident[] }> {
  const residents = await getBrasilResidents(leagueId);
  return { layout: layoutFromResidents(residents), residents };
}

export type PlaceOutcome = { status: "added" | "already" | "moved"; x: number; z: number; hub: number };

/**
 * Puts a developer on the map in their state (null: the island), as an
 * active member of the town. Already there in the same state: nothing
 * changes. Already there in another state: they move (a new lot, the old one
 * freed), only when `allowMove` (the site's state picker, not a comment).
 */
export async function placeBrasilResident(
  league: Pick<League, "id">,
  dev: { id: number; login: string },
  uf: UF | null,
  source: ResidentSource,
  allowMove = false,
): Promise<PlaceOutcome> {
  const sb = getSupabaseAdmin();
  const { data: current } = await sb
    .from("brasil_residents")
    .select("uf, hub, x, z")
    .eq("league_id", league.id)
    .eq("developer_id", dev.id)
    .maybeSingle<{ uf: string | null; hub: number; x: number; z: number }>();
  if (current && (current.uf === uf || !allowMove)) return { status: "already", x: current.x, z: current.z, hub: current.hub };

  await ensureMember(league.id, dev.id, source);
  for (let attempt = 0; attempt < 4; attempt++) {
    const others = (await getBrasilResidents(league.id)).filter((r) => r.dev.id !== dev.id);
    const lot = new BrasilPlacer(others).place({ id: dev.id, login: dev.login, uf } satisfies MapDev);
    if (!lot) throw new Error("brasil: no lot left anywhere");
    const row = { league_id: league.id, developer_id: dev.id, uf, hub: lot.hub, x: lot.x, z: lot.z, source, placed_at: new Date().toISOString() };
    const { error } = current
      ? await sb.from("brasil_residents").update(row).eq("league_id", league.id).eq("developer_id", dev.id)
      : await sb.from("brasil_residents").insert(row);
    if (!error) {
      invalidateLeague(league.id);
      return { status: current ? "moved" : "added", x: lot.x, z: lot.z, hub: lot.hub };
    }
    // 23505: someone took that lot a moment ago (or this dev arrived twice at once). Read again and retry.
    if (error.code !== "23505") throw new Error(`brasil place: ${error.message}`);
    const { data: raced } = await sb.from("brasil_residents").select("uf, hub, x, z").eq("league_id", league.id).eq("developer_id", dev.id).maybeSingle<{ uf: string | null; hub: number; x: number; z: number }>();
    if (raced && !current) return { status: "already", x: raced.x, z: raced.z, hub: raced.hub };
  }
  throw new Error("brasil place: too many retries");
}

/** A resident is an active member (a comment needs no invite or quota: they asked to be on the map). */
async function ensureMember(leagueId: string, devId: number, source: ResidentSource) {
  const sb = getSupabaseAdmin();
  const { data: m } = await sb.from("league_members").select("status").eq("league_id", leagueId).eq("developer_id", devId).maybeSingle<{ status: string }>();
  if (m?.status === "active") return;
  const { error } = await sb.from("league_members").upsert(
    {
      league_id: leagueId,
      developer_id: devId,
      status: "active",
      joined_at: new Date().toISOString(),
      left_at: null,
      removed_by: null,
      joined_via: source === "instagram" ? "instagram" : "open",
    },
    { onConflict: "league_id,developer_id" },
  );
  if (error) throw new Error(`brasil member: ${error.message}`);
}

// ─── Comments from the reels ────────────────────────────────

export const IMPORT = {
  /** Most new residents one reel adds in an hour (a flood is someone gaming it). */
  perReelHour: 400,
} as const;

export interface ReelComment {
  /** The platform's comment id: a comment is imported once. */
  id: string;
  reel: string;
  igUser: string | null;
  text: string;
  /** What the reel is about: the Brasil map (the default), or just a building in the city. */
  kind?: ReelKind;
  /** The comment already read (by the model, or as a "sim" to our suggestion); else the rules read it. */
  parsed?: { login: string | null; uf: UF | null };
  /** Its log row is already there (the caller claimed it): fill it in instead of adding one. */
  claimed?: boolean;
}

export type ReelKind = "brasil" | "city";

export type ImportOutcome = "added" | "already" | "unknown_user" | "no_login" | "blocked" | "capped";

/**
 * One comment: read it, check the username on GitHub (creating the dev if
 * Git City doesn't have them yet), put them on the map in the state they
 * named (none: the island), and log what came of it. A comment seen before
 * returns what it got then, not fresh (so it is never answered twice). One
 * Instagram account puts one GitHub login on the map. A city reel's comment
 * only gives the dev their building in the city: "added" when it's new.
 */
export async function importBrasilComment(
  league: Pick<League, "id">,
  c: ReelComment,
): Promise<{ outcome: ImportOutcome; login: string | null; uf: UF | null; fresh: boolean }> {
  const sb = getSupabaseAdmin();
  const { data: seen } = c.claimed
    ? { data: null }
    : await sb.from("brasil_comments").select("outcome, github_login, uf").eq("id", c.id).maybeSingle<{ outcome: ImportOutcome; github_login: string | null; uf: UF | null }>();
  if (seen) return { outcome: seen.outcome, login: seen.github_login, uf: seen.uf, fresh: false };

  const { login, uf } = c.parsed ?? parseComment(c.text);
  const log = async (outcome: ImportOutcome, developerId: number | null = null) => {
    const row = { reel: c.reel, ig_user: c.igUser, github_login: login, uf, developer_id: developerId, outcome };
    if (c.claimed) await sb.from("brasil_comments").update(row).eq("id", c.id);
    else await sb.from("brasil_comments").insert({ id: c.id, ...row });
    return { outcome, login, uf, fresh: true };
  };
  if (!login) return log("no_login");

  if (c.igUser) {
    const { data: earlier } = await sb.from("brasil_comments").select("github_login").eq("ig_user", c.igUser).eq("outcome", "added").limit(1).maybeSingle<{ github_login: string }>();
    if (earlier && earlier.github_login !== login) return log("blocked");
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await sb.from("brasil_comments").select("id", { count: "exact", head: true }).eq("reel", c.reel).eq("outcome", "added").gte("created_at", hourAgo);
  if ((count ?? 0) >= IMPORT.perReelHour) return log("capped");

  let dev: { id: number; github_login: string } | null = null;
  const { data: known } = await sb.from("developers").select("id, github_login").eq("github_login", login).maybeSingle<{ id: number; github_login: string }>();
  dev = known;
  if (c.kind === "city" && dev) return log("already", dev.id);
  if (!dev) {
    try {
      dev = await createDeveloperFromGitHub(login);
    } catch (err) {
      if (err instanceof GitHubFetchError) return log("unknown_user");
      throw err;
    }
    if (c.kind === "city") return log("added", dev.id);
  }

  const placed = await placeBrasilResident(league, { id: dev.id, login: dev.github_login }, uf, "instagram");
  if (placed.status === "added") await emailOnMap(league, { id: dev.id, login: dev.github_login }, uf, placed.hub);
  return log(placed.status === "already" ? "already" : "added", dev.id);
}

/** "Você tá no mapa": the email to a dev a comment just placed (only those with an account get it). */
async function emailOnMap(league: Pick<League, "id">, dev: { id: number; login: string }, uf: UF | null, hub: number) {
  let founder = false;
  if (uf) {
    const { data: first } = await getSupabaseAdmin()
      .from("brasil_residents")
      .select("developer_id")
      .eq("league_id", league.id)
      .eq("uf", uf)
      .order("placed_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ developer_id: number }>();
    founder = first?.developer_id === dev.id;
  }
  const city = !uf || hub === 9 ? ISLAND.name : hub === 1 ? (SECOND_CITIES[uf]?.city ?? CAPITALS[uf].city) : CAPITALS[uf].city;
  sendBrasilMapNotification({
    developerId: dev.id,
    login: dev.login,
    uf,
    state: uf ? (STATES.find((s) => s.uf === uf)?.name ?? null) : null,
    stateThe: uf ? ptState(uf, "the") : null,
    stateIn: uf ? ptState(uf, "in") : null,
    stateOf: uf ? ptState(uf, "of") : null,
    city: uf ? city : null,
    founder,
  });
}

// ─── The week the offices come from ─────────────────────────

export interface BrasilWeek {
  /** The Monday (UTC) of the week the totals are for. */
  weekStart: string;
  /** No closed week yet: the totals are this week's so far. */
  provisional: boolean;
  /** Each resident's contributions that week (login lowercase; each day capped like the towns' race). */
  totals: Record<string, number>;
}

/** Last closed week's frozen standings (the offices hold all of this week), else this week so far. */
export async function getBrasilWeek(leagueId: string): Promise<BrasilWeek> {
  const thisWeek = weekStart(new Date());
  const last = new Date(thisWeek.getTime() - 7 * 86_400_000);
  const lastIso = last.toISOString().slice(0, 10);
  const { data } = await getSupabaseAdmin()
    .from("league_weeks")
    .select("standings")
    .eq("league_id", leagueId)
    .eq("week_start", lastIso)
    .maybeSingle<{ standings: { standings?: { login: string; total: number }[] } | null }>();
  const frozen = data?.standings?.standings;
  if (frozen?.length) return { weekStart: lastIso, provisional: false, totals: Object.fromEntries(frozen.map((s) => [s.login.toLowerCase(), s.total])) };
  const live = await loadLeagueStandings({ id: leagueId }, thisWeek);
  return { weekStart: thisWeek.toISOString().slice(0, 10), provisional: true, totals: Object.fromEntries(live.standings.map((s) => [s.login.toLowerCase(), s.total])) };
}
