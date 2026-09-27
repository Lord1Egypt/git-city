import { getSupabaseAdmin } from "../supabase";
import { sendNotification } from "../notifications";
import { EMAIL_BASE_URL, button, heading, heroImage, paragraph, trackedUrl } from "../email/components";
import { renderLayout, renderText, type EmailLinks } from "../email/layout";
import { townDisplayName } from "../towns/names";
import { RIVALRY } from "../towns/rivalry";
import type { League } from "../leagues/service";
import type { SmashTown } from "../league-city/smash-server";
import { rubbleBySlug } from "../league-city/rubble";

// "@x knocked your building down" — sent when a rival takes the last floor of
// your building in your rivalry town (the drive room's signed save). The
// raid alert's loop: who did it, the picture (their flag on your rubble and
// the score between the towns), and one way back: hit their town. At most one
// every 3 days per dev, however many times it falls.

const EVERY_MS = 3 * 86_400_000;

export interface TownDemolishedEmailData {
  leagueSlug: string;
  leagueName: string;
  attackerLogin: string;
  victimLogin: string;
  /** The attacker's town (where to hit back). */
  rivalSlug: string;
  rivalName: string;
  /** Buildings in rubble right now: your town's, and theirs (your side's score). */
  downHere: number;
  downThere: number;
}

function header(d: TownDemolishedEmailData) {
  const town = townDisplayName(d.leagueName);
  const rival = townDisplayName(d.rivalName);
  return {
    town,
    rival,
    subject: `@${d.attackerLogin} knocked your building down`,
    preheader: `Their flag is flying on your rubble in ${town}. Hit ${rival} back.`,
  };
}

export function renderTownDemolishedEmail(d: TownDemolishedEmailData, links: EmailLinks) {
  const { town, rival, subject, preheader } = header(d);
  const hitBack = trackedUrl(`/town/${d.rivalSlug}?drive=1`, "town_demolished");
  const hero = `${EMAIL_BASE_URL}/town/${d.leagueSlug}/demolished-image?attacker=${encodeURIComponent(d.attackerLogin)}&victim=${encodeURIComponent(d.victimLogin)}&v=${d.downHere}-${d.downThere}`;
  const intro = `Their flag is on your rubble in ${town}.`;
  const rebuild = "Or park against your building to rebuild it.";
  const reason = `You're getting this because a rival knocked down your building in ${town} on Git City.`;

  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: hero, href: hitBack, alt: `@${d.attackerLogin} knocked down @${d.victimLogin}'s building in ${town}` }),
    body: [
      heading("", `@${d.attackerLogin}`, " knocked you down"),
      paragraph(intro),
      button(`Hit ${rival} back`, hitBack),
      `<div style="height:16px; line-height:16px; font-size:0;">&nbsp;</div>`,
      paragraph(rebuild, { muted: true }),
    ].join("\n"),
    reason,
    links,
  });
  const text = renderText({
    lines: [`@${d.attackerLogin} knocked you down`, "", intro, "", `Hit ${rival} back: ${hitBack}`, "", rebuild],
    reason,
    links,
  });
  return { subject, preheader, html, text };
}

/** Emails the owner of a building that just fell, unless they got one in the last 3 days. */
export async function notifyDemolished(league: League, town: SmashTown, victim: string, attacker: string): Promise<void> {
  const developerId = town.devIds[victim];
  const rival = RIVALRY.find((r) => r.slug !== league.slug);
  if (developerId === undefined || !rival || !/^[a-z0-9_-]{1,39}$/i.test(attacker)) return;
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

  // Server-only, and this module is also loaded by the email previews.
  const { getLeagueBySlug } = await import("../leagues/service");
  const [rivalLeague, down] = await Promise.all([getLeagueBySlug(rival.slug), rubbleBySlug().catch(() => ({}) as Record<string, number>)]);
  const data: TownDemolishedEmailData = {
    leagueSlug: league.slug,
    leagueName: league.name,
    attackerLogin: attacker,
    victimLogin: victim,
    rivalSlug: rival.slug,
    rivalName: rivalLeague?.name ?? rival.name,
    downHere: down[league.slug] ?? 1,
    downThere: down[rival.slug] ?? 0,
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
    actionUrl: `${EMAIL_BASE_URL}/town/${rival.slug}?drive=1`,
    priority: "high",
    channels: ["email"],
  });
}
