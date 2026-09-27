import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateCityLayout, type CityBuilding, type DeveloperRecord } from "@/lib/github";
import { leagueTag } from "@/lib/leagues/cache";
import { getCityNorms, getLeagueCityDevs, getLeagueMembers } from "@/lib/leagues/queries";
import { isoDay, weekContributions, weekStart } from "@/lib/leagues/scoring";
import { rivalOf } from "@/lib/towns/rivalry";
import { leagueBuildings, scaleTownHeights } from "./buildings";
import { getCachedCity } from "./service";
import { toTarget, type DamageEntry, type SmashTarget } from "./smash";

// ─── Rivalry smash (server) ─────────────────────────────────
// The town's buildings as smash targets (the same formulas the town page
// draws with), its saved damage, who may smash, and the signed saves the
// PartyKit drive room sends (party/drive.ts signs them with the shared
// FORCE_PUSH_HMAC_SECRET).

export interface SmashTown {
  targets: SmashTarget[];
  /** loginLower → developer id, for saves. */
  devIds: Record<string, number>;
}

/** The town's buildings exactly as its page lays them out. Cached 60s per town. */
export function getSmashTown(leagueId: string): Promise<SmashTown> {
  return unstable_cache(
    async (): Promise<SmashTown> => {
      const members = await getLeagueMembers(leagueId);
      const [city, cityDevs, norms] = await Promise.all([getCachedCity(leagueId), getLeagueCityDevs(members), getCityNorms()]);
      const devs = cityDevs as unknown as DeveloperRecord[];
      const layout = generateCityLayout(devs, undefined, norms);
      const byLogin = new Map(layout.buildings.map((b) => [b.loginLower, b]));
      const byDevId = new Map<number, CityBuilding>();
      const devIds: Record<string, number> = {};
      for (const d of devs) {
        const b = byLogin.get(d.github_login.toLowerCase());
        if (!b) continue;
        byDevId.set(d.id, b);
        devIds[d.github_login.toLowerCase()] = d.id;
      }
      const buildings = leagueBuildings(city.objects, scaleTownHeights(byDevId));
      return { targets: buildings.map(toTarget), devIds };
    },
    ["smash-town", leagueId],
    { revalidate: 60, tags: [leagueTag(leagueId)] },
  )();
}

/** Each dev's contributions this week (daily cap applied, like the score). */
export async function weekContribs(devIds: number[], now = new Date()): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (devIds.length === 0) return out;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("league_weekly_stats")
    .select("developer_id, day, contributions")
    .in("developer_id", devIds)
    .eq("week_start", isoDay(weekStart(now)))
    .returns<{ developer_id: number; day: string; contributions: number }[]>();
  const days = new Map<number, { day: string; contributions: number }[]>();
  for (const r of data ?? []) days.set(r.developer_id, [...(days.get(r.developer_id) ?? []), r]);
  for (const id of devIds) out.set(id, weekContributions(days.get(id) ?? []));
  return out;
}

interface DamageRow {
  developer_id: number;
  rows: number[];
  regen_from: string;
  contrib_base: number;
  demolished_by: number | null;
}

/** The town's saved damage, with the owners' contributions now (the store grows floors back from them). */
export async function getDamage(leagueId: string, town: SmashTown): Promise<DamageEntry[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("town_building_damage")
    .select("developer_id, rows, regen_from, contrib_base, demolished_by")
    .eq("league_id", leagueId)
    .returns<DamageRow[]>();
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const loginOf = new Map(Object.entries(town.devIds).map(([login, id]) => [id, login]));
  const killers = [...new Set(rows.map((r) => r.demolished_by).filter((id): id is number => id !== null && !loginOf.has(id)))];
  if (killers.length) {
    const { data: devs } = await sb.from("developers").select("id, github_login").in("id", killers).returns<{ id: number; github_login: string }[]>();
    for (const d of devs ?? []) loginOf.set(d.id, d.github_login.toLowerCase());
  }
  const contribs = await weekContribs(rows.map((r) => r.developer_id));
  const out: DamageEntry[] = [];
  for (const r of rows) {
    const login = loginOf.get(r.developer_id);
    if (!login || !(login in town.devIds)) continue;
    out.push({
      login,
      rows: r.rows,
      regenFrom: Date.parse(r.regen_from),
      contribBase: r.contrib_base,
      contribNow: contribs.get(r.developer_id) ?? 0,
      demolishedBy: r.demolished_by !== null ? (loginOf.get(r.demolished_by) ?? null) : null,
    });
  }
  return out;
}

// ─── Who may smash ──────────────────────────────────────────

export interface SmashViewer {
  login: string;
  devId: number;
  /** An active member of the rival side of this town. */
  canSmash: boolean;
  /** An active member of this town (its buildings are theirs to defend, not break). */
  home: boolean;
}

/** The dev behind a Supabase access token, and whether they're on the other side of `slug`. */
export async function smashViewer(token: string, slug: string): Promise<SmashViewer | null> {
  const sb = getSupabaseAdmin();
  const { data: auth } = await sb.auth.getUser(token);
  const userId = auth?.user?.id;
  if (!userId) return null;
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login")
    .eq("claimed_by", userId)
    .limit(1)
    .maybeSingle<{ id: number; github_login: string }>();
  if (!dev) return null;
  const rival = rivalOf(slug);
  const { data: sides } = await sb
    .from("league_members")
    .select("leagues!inner(slug)")
    .eq("developer_id", dev.id)
    .eq("status", "active")
    .in("leagues.slug", [slug, ...(rival ? [rival] : [])])
    .returns<{ leagues: { slug: string } }[]>();
  const on = new Set((sides ?? []).map((r) => r.leagues.slug));
  return { login: dev.github_login.toLowerCase(), devId: dev.id, canSmash: !!rival && on.has(rival), home: on.has(slug) };
}

// ─── Signed saves from the drive room ───────────────────────

export interface SmashSave {
  at: number;
  rows: { login: string; rows: number[]; regenFrom: number; contribBase: number; demolishedBy: string | null }[];
  demolished: { victim: string; attacker: string }[];
}

/** The room signs `${slug}.${body}`; a save more than a minute old is refused. */
export function verifySmashSave(slug: string, body: string, signature: string | null, now = Date.now()): SmashSave | null {
  const secret = process.env.FORCE_PUSH_HMAC_SECRET;
  if (!secret || secret.length < 32 || !signature || body.length > 200_000) return null;
  const want = createHmac("sha256", secret).update(`${slug}.${body}`).digest();
  const got = Buffer.from(signature, "hex");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let save: SmashSave;
  try {
    save = JSON.parse(body) as SmashSave;
  } catch {
    return null;
  }
  if (typeof save.at !== "number" || Math.abs(now - save.at) > 60_000) return null;
  if (!Array.isArray(save.rows) || !Array.isArray(save.demolished)) return null;
  return save;
}

/** Writes the room's damage: damaged buildings upserted, healed ones deleted. */
export async function saveDamage(leagueId: string, town: SmashTown, save: SmashSave): Promise<void> {
  const sb = getSupabaseAdmin();
  const floorsOf = new Map(town.targets.map((t) => [t.login, t.floors]));
  const upserts = [];
  const healed: number[] = [];
  // A building first hit in this room session comes with base -1: its owner's contributions now.
  const fresh = save.rows.filter((r) => !(Number(r.contribBase) >= 0)).map((r) => town.devIds[r.login]).filter((id) => id !== undefined);
  const baseNow = await weekContribs(fresh);
  for (const r of save.rows) {
    const devId = town.devIds[r.login];
    const floors = floorsOf.get(r.login);
    if (devId === undefined || floors === undefined || !Array.isArray(r.rows) || r.rows.length === 0 || r.rows.length > 16) continue;
    const rows = r.rows.map((n) => Math.max(0, Math.min(floors, Math.round(Number(n) || 0))));
    if (rows.every((n) => n >= floors)) {
      healed.push(devId);
      continue;
    }
    const killer = r.demolishedBy ? await devIdOf(r.demolishedBy, town) : null;
    upserts.push({
      league_id: leagueId,
      developer_id: devId,
      rows,
      regen_from: new Date(Number(r.regenFrom) || Date.now()).toISOString(),
      contrib_base: Number(r.contribBase) >= 0 ? Math.round(Number(r.contribBase)) : (baseNow.get(devId) ?? 0),
      demolished_by: killer,
      demolished_at: killer ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  }
  if (upserts.length) await sb.from("town_building_damage").upsert(upserts, { onConflict: "league_id,developer_id" });
  if (healed.length) await sb.from("town_building_damage").delete().eq("league_id", leagueId).in("developer_id", healed);
}

/** A login's developer id: from the town, or looked up (the attacker lives in the other town). */
export async function devIdOf(login: string, town: SmashTown): Promise<number | null> {
  if (login in town.devIds) return town.devIds[login];
  const { data } = await getSupabaseAdmin()
    .from("developers")
    .select("id")
    .ilike("github_login", login.replace(/[%_\\]/g, ""))
    .limit(1)
    .maybeSingle<{ id: number }>();
  return data?.id ?? null;
}
