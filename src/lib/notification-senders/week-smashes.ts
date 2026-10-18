import { getSupabaseAdmin } from "../supabase";
import { textLink, trackedUrl } from "../email/components";
import { attackerTown } from "../league-city/rubble";

// The Monday emails' smash line: who knocked your building down in the closed
// week and how many you knocked down, with one link to hit the last one back.

export interface WeekSmashes {
  /** Who knocked you down, most recent first, once each. */
  by: string[];
  /** Buildings you knocked down. */
  knocked: number;
  /** Where the last one who hit you lives (null: they live in no town). */
  hitBack: { login: string; slug: string } | null;
}

interface FallRow {
  victim_id: number;
  attacker_id: number;
  fell_at: string;
  leagues: { slug: string } | null;
  attacker: { github_login: string } | null;
}

/** Each dev's falls in [from, to). Devs with none are left out. */
export async function weekSmashes(devIds: number[], from: string, to: string): Promise<Map<number, WeekSmashes>> {
  const out = new Map<number, WeekSmashes>();
  if (devIds.length === 0) return out;
  const sb = getSupabaseAdmin();
  const ids = new Set(devIds);
  const last = new Map<number, { attackerId: number; slug: string }>();
  for (let i = 0; i < devIds.length; i += 200) {
    const chunk = devIds.slice(i, i + 200);
    const [hit, knocked] = await Promise.all([
      sb
        .from("town_demolitions")
        .select("victim_id, attacker_id, fell_at, leagues(slug), attacker:developers!town_demolitions_attacker_id_fkey(github_login)")
        .in("victim_id", chunk)
        .gte("fell_at", from)
        .lt("fell_at", to)
        .order("fell_at", { ascending: false })
        .returns<FallRow[]>(),
      sb.from("town_demolitions").select("attacker_id").in("attacker_id", chunk).gte("fell_at", from).lt("fell_at", to),
    ]);
    if (hit.error) throw hit.error;
    if (knocked.error) throw knocked.error;
    for (const r of hit.data ?? []) {
      const login = r.attacker?.github_login;
      if (!login || !ids.has(r.victim_id)) continue;
      const s = out.get(r.victim_id) ?? { by: [], knocked: 0, hitBack: null };
      if (!s.by.includes(login)) s.by.push(login);
      out.set(r.victim_id, s);
      if (!last.has(r.victim_id) && r.leagues) last.set(r.victim_id, { attackerId: r.attacker_id, slug: r.leagues.slug });
    }
    for (const r of knocked.data ?? []) {
      const id = r.attacker_id as number;
      const s = out.get(id) ?? { by: [], knocked: 0, hitBack: null };
      s.knocked++;
      out.set(id, s);
    }
  }
  await Promise.all(
    [...last].map(async ([victimId, { attackerId, slug }]) => {
      const s = out.get(victimId)!;
      const town = await attackerTown(attackerId, slug).catch(() => null);
      if (town) s.hitBack = { login: s.by[0], slug: town.slug };
    }),
  );
  return out;
}

const buildings = (n: number) => `${n} building${n === 1 ? "" : "s"}`;

/** "@a and 2 others knocked your building down last week. You knocked down 3 buildings." */
export function smashLine(s: WeekSmashes): string {
  const hit =
    s.by.length === 0
      ? ""
      : s.by.length === 1
        ? `@${s.by[0]} knocked your building down last week.`
        : `@${s.by[0]} and ${s.by.length - 1} other${s.by.length === 2 ? "" : "s"} knocked your building down last week.`;
  const mine = s.knocked === 0 ? "" : s.by.length ? `You knocked down ${buildings(s.knocked)}.` : `You knocked down ${buildings(s.knocked)} last week.`;
  return [hit, mine].filter(Boolean).join(" ");
}

/** The hit-back link: the car next to their building, as in the "knocked down" email. */
export function hitBackUrl(s: WeekSmashes, campaign: string): string | null {
  return s.hitBack ? trackedUrl(`/town/${s.hitBack.slug}?drive=1&at=${encodeURIComponent(s.hitBack.login)}`, campaign) : null;
}

export function hitBackLink(s: WeekSmashes, campaign: string): string {
  const url = hitBackUrl(s, campaign);
  return url && s.hitBack ? textLink(`Hit @${s.hitBack.login} back`, url) : "";
}
