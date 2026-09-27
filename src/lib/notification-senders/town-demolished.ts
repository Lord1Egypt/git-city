import { getSupabaseAdmin } from "../supabase";
import { sendNotification } from "../notifications";
import { EMAIL_BASE_URL, button, heading, paragraph, trackedUrl } from "../email/components";
import { renderLayout, renderText, type EmailLinks } from "../email/layout";
import { townDisplayName } from "../towns/names";
import type { League } from "../leagues/service";
import type { SmashTown } from "../league-city/smash-server";

// "@x knocked down your building" — sent when a rival takes the last floor of
// your building in your rivalry town (the drive room's signed save). At most
// one every 3 days per dev, however many times it falls.

const EVERY_MS = 3 * 86_400_000;

export interface TownDemolishedEmailData {
  leagueSlug: string;
  leagueName: string;
  attackerLogin: string;
}

function header(d: TownDemolishedEmailData) {
  const town = townDisplayName(d.leagueName);
  return {
    town,
    subject: `@${d.attackerLogin} knocked down your building in ${town}`,
    preheader: "It's rubble now. Park against it to build it back.",
  };
}

export function renderTownDemolishedEmail(d: TownDemolishedEmailData, links: EmailLinks) {
  const { town, subject, preheader } = header(d);
  const url = trackedUrl(`/town/${d.leagueSlug}?drive=1`, "town_demolished");
  const intro = `A rival drove through your building in ${town} until the last floor came down. Their name is on the rubble for everyone to see.`;
  const howTo = "It grows back a floor every hour and a floor for every contribution you make. Drive there and park against it to build it back in seconds.";
  const reason = `You're getting this because a rival knocked down your building in ${town} on Git City.`;

  const html = renderLayout({
    title: subject,
    preheader,
    body: [heading("", `@${d.attackerLogin}`, " knocked you down"), paragraph(intro), paragraph(howTo), button("Build it back", url)].join("\n"),
    reason,
    links,
  });
  const text = renderText({
    lines: [`@${d.attackerLogin} knocked down your building in ${town}`, "", intro, "", howTo, "", `Build it back: ${url}`],
    reason,
    links,
  });
  return { subject, preheader, html, text };
}

/** Emails the owner of a building that just fell, unless they got one in the last 3 days. */
export async function notifyDemolished(league: League, town: SmashTown, victim: string, attacker: string): Promise<void> {
  const developerId = town.devIds[victim];
  if (developerId === undefined || !/^[a-z0-9-]{1,39}$/i.test(attacker)) return;
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

  const data: TownDemolishedEmailData = { leagueSlug: league.slug, leagueName: league.name, attackerLogin: attacker };
  const { subject, preheader } = header(data);
  await sendNotification({
    type: "town_demolished",
    category: "leagues",
    developerId,
    dedupKey: `town_demolished:${developerId}:${Math.floor(Date.now() / EVERY_MS)}`,
    title: subject,
    body: preheader,
    render: (links) => renderTownDemolishedEmail(data, links),
    actionUrl: `${EMAIL_BASE_URL}/town/${league.slug}?drive=1`,
    priority: "high",
    channels: ["email"],
  });
}
