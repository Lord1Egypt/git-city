import { getSupabaseAdmin } from "../supabase";
import { sendNotification } from "../notifications";
import { EMAIL_BASE_URL, button, heroImage, paragraph, trackedUrl } from "../email/components";
import { renderLayout, renderText, type EmailLinks } from "../email/layout";
import { RIVALRY } from "../towns/rivalry";
import { SIDES, battleWeekNumber, type Side } from "../towns/battle-rules";
import { getWeekResult } from "../towns/battle";
import type { ClosedLeague } from "../leagues/close";
import { contributions } from "./town-email";

// Claude vs Codex emails, both from the Monday close: "The battle is on" the
// Monday the first battle week opens, then each Monday the week's result for
// every member of either side. Hero, one line, one button.

const nameOf = (s: Side) => RIVALRY[SIDES.indexOf(s)].name;

// ─── The battle is on ───────────────────────────────────────

export interface BattleStartEmailData {
  side: Side;
  /** The hero's URL (/towns/battle-image); previews pass a fixed one. */
  heroUrl: string;
}

function startHeader(d: BattleStartEmailData) {
  // The picture already says it counts from today.
  const line = `You're on ${nameOf(d.side)}. Code this week and bring your friends.`;
  return { subject: "The battle is on", preheader: line, line };
}

export function renderBattleStartEmail(d: BattleStartEmailData, links: EmailLinks) {
  const { subject, preheader, line } = startHeader(d);
  const url = trackedUrl("/towns", "battle_start");
  const reason = `You're getting this because you picked ${nameOf(d.side)} in Claude vs Codex on Git City.`;
  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: d.heroUrl, href: url, alt: `Claude vs Codex, week 1. It counts from today.` }),
    body: [paragraph(line), button("See the battle", url)].join("\n"),
    reason,
    links,
  });
  const text = renderText({ lines: [subject, "", line, "", `See the battle: ${url}`], reason, links });
  return { subject, preheader, html, text };
}

/** Everyone on a side when the first battle week opens. Deduped per dev, so a rerun never sends twice. */
export async function sendBattleStart(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data: towns, error } = await sb.from("leagues").select("id, slug").in("slug", RIVALRY.map((r) => r.slug));
  if (error) throw error;
  let sent = 0;
  for (const town of towns ?? []) {
    const side = SIDES[RIVALRY.findIndex((r) => r.slug === town.slug)];
    const { data: members, error: mErr } = await sb.from("league_members").select("developer_id").eq("league_id", town.id).eq("status", "active");
    if (mErr) throw mErr;
    const data: BattleStartEmailData = { side, heroUrl: `${EMAIL_BASE_URL}/towns/battle-image` };
    const { subject, preheader } = startHeader(data);
    for (const m of members ?? []) {
      const results = await sendNotification({
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
      if (results.some((r) => r.success)) sent++;
    }
  }
  return sent;
}

// ─── Weekly result ──────────────────────────────────────────

export interface BattleResultEmailData {
  week: number;
  winner: Side | null;
  claude: number | null;
  codex: number | null;
  side: Side;
  /** The reader's contributions in the week (daily cap applied). */
  mine: number;
  heroUrl: string;
}

function resultHeader(d: BattleResultEmailData) {
  // The picture carries the score; the line is yours.
  const line = d.mine > 0 ? `You coded ${contributions(d.mine)} for ${nameOf(d.side)}.` : `You didn't code for ${nameOf(d.side)} that week.`;
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
  const reason = `You're getting this because you're on ${nameOf(d.side)} in Claude vs Codex on Git City.`;
  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: d.heroUrl, href: url, alt: `${subject}: Claude ${d.claude ?? "–"}, Codex ${d.codex ?? "–"} per dev` }),
    body: [paragraph(line), button(cta, url)].join("\n"),
    reason,
    links,
  });
  const text = renderText({ lines: [subject, "", line, "", `${cta}: ${url}`], reason, links });
  return { subject, preheader, html, text };
}

/**
 * The closed week's result to every member of both sides, from their town's
 * frozen standings (so a Monday switch doesn't move anyone's email). In place
 * of the town race email for the two rivalry towns.
 */
export async function sendBattleResults(rivalry: ClosedLeague[]): Promise<number> {
  const weekStart = rivalry[0]?.week.weekStart;
  if (!weekStart) return 0;
  const result = await getWeekResult(weekStart);
  if (!result) return 0;
  const week = battleWeekNumber(weekStart);
  let sent = 0;
  for (const c of rivalry) {
    const side = SIDES[RIVALRY.findIndex((r) => r.slug === c.league.slug)];
    for (const me of c.week.standings) {
      const data: BattleResultEmailData = {
        week,
        winner: result.winner,
        claude: result.claude?.perDev ?? null,
        codex: result.codex?.perDev ?? null,
        side,
        mine: me.total,
        heroUrl: `${EMAIL_BASE_URL}/towns/battle-image?week=${weekStart}`,
      };
      const { subject, preheader } = resultHeader(data);
      const results = await sendNotification({
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
      if (results.some((r) => r.success)) sent++;
    }
  }
  return sent;
}
