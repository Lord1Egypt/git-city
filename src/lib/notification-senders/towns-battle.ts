import { getSupabaseAdmin } from "../supabase";
import { sendNotification, type NotificationPayload } from "../notifications";
import { mapWithConcurrency } from "../concurrency";
import { EMAIL_BASE_URL, button, heroImage, paragraph, textLink, trackedUrl } from "../email/components";
import { renderLayout, renderText, type EmailLinks } from "../email/layout";
import { BATTLE_START, RIVALRY } from "../towns/rivalry";
import { getPlayWeekRow } from "../towns/play-load";
import { SIDES, battleWeekNumber, type Side } from "../towns/battle-rules";
import { PRIZE_CREDITS, PRIZE_SPONSOR, PRIZE_WINNERS, RULES_PATH } from "../towns/play-rules";
import { SPONSOR } from "../towns/sponsor";
import { hitBackLink, hitBackUrl, smashLine, weekSmashes, type WeekSmashes } from "./week-smashes";

// Claude vs Codex emails, both from the Monday close: "The battle is on" the
// Monday the first battle week opens, then each Monday the week's result for
// every member of either side. Hero, one line, one button.

const nameOf = (s: Side) => RIVALRY[SIDES.indexOf(s)].name;
const points = (n: number) => `${n.toLocaleString("en-US")} point${n === 1 ? "" : "s"}`;

/** Hundreds of members share the Monday close's 300s: send 8 at a time (sendEmail throttles for Resend). */
async function sendAll(payloads: NotificationPayload[]): Promise<number> {
  const settled = await mapWithConcurrency(payloads, 8, (p) => sendNotification(p));
  return settled.filter((r) => r.status === "fulfilled" && r.value.some((x) => x.success)).length;
}

// ─── The battle is on ───────────────────────────────────────

export interface BattleStartEmailData {
  side: Side;
  /** The hero's URL (/towns/battle-image); previews pass a fixed one. */
  heroUrl: string;
}

function startHeader(d: BattleStartEmailData) {
  // The picture already says it counts from today.
  const line = `You're on ${nameOf(d.side)}. Everything you do in Git City scores this week.`;
  const prize = PRIZE_SPONSOR ? ` The top ${PRIZE_WINNERS} each week win ${PRIZE_CREDITS.toLocaleString("en-US")} ${PRIZE_SPONSOR} credits.` : "";
  return { subject: "The battle is on", preheader: line, line: line + prize };
}

export function renderBattleStartEmail(d: BattleStartEmailData, links: EmailLinks) {
  const { subject, preheader, line } = startHeader(d);
  const url = trackedUrl("/towns", "battle_start");
  const rulesUrl = trackedUrl(RULES_PATH, "battle_start");
  const reason = `You're getting this because you picked ${nameOf(d.side)} in Claude vs Codex on Git City.`;
  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: d.heroUrl, href: url, alt: `Claude vs Codex, week 1. It counts from today.` }),
    body: [paragraph(line), button("See the battle", url), textLink("How scoring and checks work", rulesUrl)].join("\n"),
    reason,
    links,
    sponsor: SPONSOR,
  });
  const text = renderText({
    lines: [subject, "", line, "", `See the battle: ${url}`, "", `How scoring and checks work: ${rulesUrl}`],
    reason,
    links,
  });
  return { subject, preheader, html, text };
}

/** Everyone on a side when the first battle week opens. Deduped per dev, so a rerun never sends twice. */
export async function sendBattleStart(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data: towns, error } = await sb.from("leagues").select("id, slug").in("slug", RIVALRY.map((r) => r.slug));
  if (error) throw error;
  const payloads: NotificationPayload[] = [];
  for (const town of towns ?? []) {
    const side = SIDES[RIVALRY.findIndex((r) => r.slug === town.slug)];
    const { data: members, error: mErr } = await sb.from("league_members").select("developer_id").eq("league_id", town.id).eq("status", "active");
    if (mErr) throw mErr;
    const data: BattleStartEmailData = { side, heroUrl: `${EMAIL_BASE_URL}/towns/battle-image` };
    const { subject, preheader } = startHeader(data);
    for (const m of members ?? []) {
      payloads.push({
        type: "battle_start",
        category: "leagues",
        developerId: m.developer_id as number,
        dedupKey: `battle_start:${m.developer_id}`,
        title: subject,
        body: preheader,
        render: (links) => renderBattleStartEmail(data, links),
        actionUrl: `${EMAIL_BASE_URL}/towns`,
        priority: "normal",
        channels: ["email"],
      });
    }
  }
  return sendAll(payloads);
}

// ─── Weekly result ──────────────────────────────────────────

export interface BattleResultEmailData {
  week: number;
  winner: Side | null;
  claude: number | null;
  codex: number | null;
  side: Side;
  /** The reader's play points in the week (caps and the 2x activity applied, no prize bonus). */
  mine: number;
  heroUrl: string;
  /** Who knocked you down that week and how many you knocked down (null: neither). */
  smash?: WeekSmashes | null;
}

function resultHeader(d: BattleResultEmailData) {
  // The picture carries the score; the line is yours.
  const line = d.mine > 0 ? `You scored ${points(d.mine)} for ${nameOf(d.side)}.` : `You didn't score for ${nameOf(d.side)} that week.`;
  return {
    subject: d.winner ? `${nameOf(d.winner)} won week ${d.week}` : `Week ${d.week} was a tie`,
    preheader: line,
    line,
    cta: d.winner === null ? "See the battle" : d.winner === d.side ? "Defend it" : "Win it back",
  };
}

export function renderBattleResultEmail(d: BattleResultEmailData, links: EmailLinks) {
  const { subject, preheader, line, cta } = resultHeader(d);
  const url = trackedUrl("/towns", "battle_result");
  const rulesUrl = trackedUrl(RULES_PATH, "battle_result");
  const smash = d.smash ? smashLine(d.smash) : "";
  const hitBack = d.smash ? hitBackUrl(d.smash, "battle_result") : null;
  const reason = `You're getting this because you're on ${nameOf(d.side)} in Claude vs Codex on Git City.`;
  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: d.heroUrl, href: url, alt: `${subject}: Claude ${d.claude ?? "–"}, Codex ${d.codex ?? "–"} per player` }),
    body: [
      paragraph(line),
      smash ? paragraph(smash) : "",
      button(cta, url),
      d.smash ? hitBackLink(d.smash, "battle_result") : "",
      textLink("How scoring and checks work", rulesUrl),
    ].join("\n"),
    reason,
    links,
    sponsor: SPONSOR,
  });
  const text = renderText({
    lines: [
      subject,
      "",
      line,
      ...(smash ? ["", smash] : []),
      "",
      `${cta}: ${url}`,
      ...(hitBack && d.smash?.hitBack ? ["", `Hit @${d.smash.hitBack.login} back: ${hitBack}`] : []),
      "",
      `How scoring and checks work: ${rulesUrl}`,
    ],
    reason,
    links,
  });
  return { subject, preheader, html, text };
}

/**
 * The closed war week's result to every player on either side, from the play
 * week the Monday close froze (town_play_weeks), so a Monday switch doesn't
 * move anyone's email. In place of the town race email for the two rivalry
 * towns. No frozen row: no battle email, logged.
 */
export async function sendBattleResults(weekStart: string): Promise<number> {
  if (Date.parse(`${weekStart}T00:00:00Z`) < BATTLE_START) return 0;
  const row = await getPlayWeekRow(weekStart);
  if (!row) {
    console.error(`[towns-battle] no play week for ${weekStart}: battle results skipped`);
    return 0;
  }
  const week = battleWeekNumber(weekStart);
  const from = `${weekStart}T00:00:00Z`;
  const to = new Date(Date.parse(from) + 7 * 86_400_000).toISOString();
  const smashes = await weekSmashes(
    row.standings.filter((s) => s.side).map((s) => s.developer_id),
    from,
    to,
  ).catch((err) => {
    console.error("[towns-battle] smash lines skipped", err);
    return new Map<number, WeekSmashes>();
  });
  const payloads: NotificationPayload[] = [];
  for (const me of row.standings) {
    if (!me.side) continue;
    const data: BattleResultEmailData = {
      week,
      winner: row.war.winner,
      claude: row.war.claude.score,
      codex: row.war.codex.score,
      side: me.side,
      mine: me.total,
      heroUrl: `${EMAIL_BASE_URL}/towns/battle-image?week=${weekStart}`,
      smash: smashes.get(me.developer_id) ?? null,
    };
    const { subject, preheader } = resultHeader(data);
    payloads.push({
      type: "battle_result",
      category: "leagues",
      developerId: me.developer_id,
      dedupKey: `battle_result:${me.developer_id}:${weekStart}`,
      title: subject,
      body: preheader,
      render: (links) => renderBattleResultEmail(data, links),
      actionUrl: `${EMAIL_BASE_URL}/towns`,
      priority: "normal",
      channels: ["email"],
    });
  }
  return sendAll(payloads);
}
