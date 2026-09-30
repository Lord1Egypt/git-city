import { getSupabaseAdmin } from "../supabase";
import { sendNotification } from "../notifications";
import { EMAIL_BASE_URL, button, heading, heroImage, paragraph, trackedUrl } from "../email/components";
import { renderLayout, renderText, type EmailLinks } from "../email/layout";
import { townDisplayName } from "../towns/names";
import type { League } from "../leagues/service";
import type { RecordedFall } from "../league-city/smash-server";
import { attackerTown, rubbleIn } from "../league-city/rubble";

// "@x knocked your building down" — sent when someone takes the last floor of
// your building in any town (the drive room's signed save). The raid alert's
// loop: who did it, the picture (their flag on your rubble), and one way back:
// the button drops you in the car next to their own building. When you had
// knocked theirs down first, it's "@x hit you back". At most one every 3 days
// per dev, however many times and in however many towns it falls.

const EVERY_MS = 3 * 86_400_000;
/** A knock counts as hitting back when you knocked theirs down this recently. */
const REVENGE_MS = 14 * 86_400_000;

export interface TownDemolishedEmailData {
  leagueSlug: string;
  leagueName: string;
  attackerLogin: string;
  victimLogin: string;
  /** Developer ids, for the picture. */
  attackerId: number;
  victimId: number;
  /** Where the attacker's own building stands (null: they live in no town). */
  hitBackSlug: string | null;
  /** You knocked theirs down first. */
  revenge: boolean;
  /** Buildings in rubble in this town right now (the picture's count). */
  down: number;
}

function header(d: TownDemolishedEmailData) {
  const town = townDisplayName(d.leagueName);
  return {
    town,
    subject: d.revenge ? `@${d.attackerLogin} hit you back` : `@${d.attackerLogin} knocked your building down`,
    preheader: d.hitBackSlug ? `Their flag is flying on your rubble in ${town}. Hit them back.` : `Their flag is flying on your rubble in ${town}.`,
  };
}

export function renderTownDemolishedEmail(d: TownDemolishedEmailData, links: EmailLinks) {
  const { town, subject, preheader } = header(d);
  const cta = d.hitBackSlug
    ? { label: `Hit @${d.attackerLogin} back`, url: trackedUrl(`/town/${d.hitBackSlug}?drive=1&at=${encodeURIComponent(d.attackerLogin)}`, "town_demolished") }
    : { label: "Rebuild it", url: trackedUrl(`/town/${d.leagueSlug}?drive=1`, "town_demolished") };
  const hero = `${EMAIL_BASE_URL}/town/${d.leagueSlug}/demolished-image?a=${d.attackerId}&d=${d.victimId}&n=${d.down}`;
  const intro = `Their flag is on your rubble in ${town}.`;
  const rebuild = "It's shielded for 12 hours. Park against it to rebuild faster.";
  const reason = `You're getting this because someone knocked down your building in ${town} on Git City.`;

  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: hero, href: cta.url, alt: `@${d.attackerLogin} knocked down @${d.victimLogin}'s building in ${town}` }),
    body: [
      heading("", `@${d.attackerLogin}`, d.revenge ? " hit you back" : " knocked you down"),
      paragraph(intro),
      button(cta.label, cta.url),
      `<div style="height:16px; line-height:16px; font-size:0;">&nbsp;</div>`,
      paragraph(rebuild, { muted: true }),
    ].join("\n"),
    reason,
    links,
  });
  const text = renderText({
    lines: [`@${d.attackerLogin}${d.revenge ? " hit you back" : " knocked you down"}`, "", intro, "", `${cta.label}: ${cta.url}`, "", rebuild],
    reason,
    links,
  });
  return { subject, preheader, html, text };
}

/** Whether the victim had knocked one of the attacker's buildings down lately (in any town). */
export async function isRevenge(attackerId: number, victimId: number): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("town_demolitions")
    .select("id")
    .eq("victim_id", attackerId)
    .eq("attacker_id", victimId)
    .gte("fell_at", new Date(Date.now() - REVENGE_MS).toISOString())
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Emails the owner of a building that just fell, unless they got one in the last 3 days. */
export async function notifyDemolished(league: League, fall: RecordedFall): Promise<void> {
  const { victim, victimId: developerId, attacker, attackerId } = fall;
  if (developerId === attackerId) return;
  const sb = getSupabaseAdmin();
  const { data: recent } = await sb
    .from("notification_log")
    .select("id")
    .eq("developer_id", developerId)
    .eq("notification_type", "town_demolished")
    .neq("status", "failed")
    .gte("created_at", new Date(Date.now() - EVERY_MS).toISOString())
    .limit(1)
    .maybeSingle();
  if (recent) return;

  const [hitBack, down, revenge] = await Promise.all([
    attackerTown(attackerId, league.slug).catch(() => null),
    rubbleIn(league.id).catch(() => 1),
    isRevenge(attackerId, developerId).catch(() => false),
  ]);
  const data: TownDemolishedEmailData = {
    leagueSlug: league.slug,
    leagueName: league.name,
    attackerLogin: attacker,
    victimLogin: victim,
    attackerId,
    victimId: developerId,
    hitBackSlug: hitBack?.slug ?? null,
    revenge,
    down: Math.max(1, down),
  };
  const { subject, preheader } = header(data);
  await sendNotification({
    type: "town_demolished",
    category: "leagues",
    developerId,
    dedupKey: `town_demolished:${developerId}:${Math.floor(Date.now() / EVERY_MS)}`,
    title: subject,
    body: preheader,
    render: (links) => renderTownDemolishedEmail(data, links),
    actionUrl: `${EMAIL_BASE_URL}/town/${data.hitBackSlug ?? league.slug}?drive=1`,
    priority: "high",
    channels: ["email"],
  });
}
