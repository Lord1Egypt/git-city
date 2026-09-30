import { renderGiftReceivedEmail } from "../../notification-senders/gift";
import { renderLeagueInvitedEmail } from "../../notification-senders/league-invited";
import { renderLeagueJoinedEmail } from "../../notification-senders/league-joined";
import { renderLeagueOvertakenEmail } from "../../notification-senders/league-overtaken";
import { renderTownDemolishedEmail } from "../../notification-senders/town-demolished";
import { renderRaceChallengeEmail, renderRacePassedEmail } from "../../notification-senders/race";
import { renderJoinRequestEmail, renderRequestApprovedEmail } from "../../notification-senders/league-requests";
import { renderLeagueWeeklyEmail, type LeagueWeeklyEmailData } from "../../notification-senders/league-weekly";
import { renderGiftSentEmail, renderPurchaseEmail } from "../../notification-senders/purchase";
import { renderBattleResultEmail, renderBattleStartEmail, type BattleResultEmailData } from "../../notification-senders/towns-battle";
import { EMAIL_BASE_URL } from "../components";
import { PREVIEW_LINKS, TRANSACTIONAL_PREVIEW_LINKS, type EmailPreviews } from "./types";

const TOWN = { leagueSlug: "ship-city", leagueName: "Ship City" };
const DATE = new Date("2026-09-25T14:00:00Z");

const WEEK: LeagueWeeklyEmailData = {
  ...TOWN,
  standings: [
    { rank: 1, login: "pyromains", total: 312 },
    { rank: 2, login: "srizzon", total: 268 },
    { rank: 3, login: "kristoferborges", total: 141 },
    { rank: 4, login: "mrousavy", total: 97 },
    { rank: 5, login: "zappymanwho", total: 40 },
    { rank: 6, login: "pedrohenrique", total: 6 },
  ],
  me: { rank: 2, login: "srizzon", total: 268 },
  winnerLogin: "pyromains",
  townOfWeekLine: "Acme Town coded the most last week and takes the monument in the center of Git City.",
  townLine: "Ship City finished 4th of 12 towns, with 144 contributions per dev.",
};

const BATTLE: BattleResultEmailData = {
  week: 1,
  winner: "claude",
  claude: 84,
  codex: 61,
  side: "codex",
  mine: 42,
  heroUrl: `${EMAIL_BASE_URL}/towns/battle-image?sample=1`,
};

// Sample renders for the admin preview (?template=<key>) and test sends.
export const TOWNS_PREVIEWS: EmailPreviews = {
  "battle-start": () => renderBattleStartEmail({ side: "claude", heroUrl: `${EMAIL_BASE_URL}/towns/battle-image` }, PREVIEW_LINKS),
  "battle-result-lost": () => renderBattleResultEmail(BATTLE, PREVIEW_LINKS),
  "battle-result-won": () => renderBattleResultEmail({ ...BATTLE, side: "claude", mine: 131 }, PREVIEW_LINKS),
  "battle-result-tie": () => renderBattleResultEmail({ ...BATTLE, winner: null, codex: 84, mine: 0 }, PREVIEW_LINKS),
  "town-joined": () => renderLeagueJoinedEmail({ ...TOWN, inviteeLogin: "pedrohenrique", countsForBuilder: true }, PREVIEW_LINKS),
  "town-joined-no-emblem": () => renderLeagueJoinedEmail({ ...TOWN, inviteeLogin: "pedrohenrique", countsForBuilder: false }, PREVIEW_LINKS),
  "town-overtaken": () =>
    renderLeagueOvertakenEmail({ ...TOWN, overtakerLogin: "pyromains", gap: 12, newRank: 2, hoursLeft: 57 }, PREVIEW_LINKS),
  "town-overtaken-last-hours": () =>
    renderLeagueOvertakenEmail(
      { ...TOWN, overtakerLogin: "kristoferborges", gap: 1, newRank: 4, hoursLeft: 5 },
      PREVIEW_LINKS,
    ),
  "town-demolished": () =>
    renderTownDemolishedEmail(
      { leagueSlug: "codex-town", leagueName: "Codex Town", attackerLogin: "srizzon", victimLogin: "yuripulga", attackerId: 12, victimId: 465, hitBackSlug: "claude-code-town", revenge: false, down: 3 },
      PREVIEW_LINKS,
    ),
  "town-demolished-hit-back": () =>
    renderTownDemolishedEmail(
      { leagueSlug: "fulldev", leagueName: "Fulldev", attackerLogin: "yuripulga", victimLogin: "srizzon", attackerId: 465, victimId: 12, hitBackSlug: "fulldev", revenge: true, down: 2 },
      PREVIEW_LINKS,
    ),
  "town-demolished-no-town": () =>
    renderTownDemolishedEmail(
      { leagueSlug: "brasil-town", leagueName: "Brasil Town", attackerLogin: "pyromains", victimLogin: "srizzon", attackerId: 7, victimId: 12, hitBackSlug: null, revenge: false, down: 1 },
      PREVIEW_LINKS,
    ),
  "race-passed": () =>
    renderRacePassedEmail({ ...TOWN, passerLogin: "pyromains", theirMs: 22_912, yourMs: 23_443, newRank: 3 }, PREVIEW_LINKS),
  "race-challenge": () =>
    renderRaceChallengeEmail({ ...TOWN, challengerLogin: "kristoferborges", theirMs: 23_104, yourMs: 27_880 }, PREVIEW_LINKS),
  "race-challenge-first": () =>
    renderRaceChallengeEmail({ ...TOWN, challengerLogin: "kristoferborges", theirMs: 23_104, yourMs: null }, PREVIEW_LINKS),
  "town-weekly-won": () =>
    renderLeagueWeeklyEmail(
      {
        ...WEEK,
        me: { rank: 1, login: "pyromains", total: 312 },
        townOfWeekLine: "Ship City coded the most of every town last week. The monument in the center of Git City is yours this week.",
        townLine: "Ship City finished 1st of 12 towns, with 144 contributions per dev.",
      },
      PREVIEW_LINKS,
    ),
  "town-weekly-lost": () => renderLeagueWeeklyEmail(WEEK, PREVIEW_LINKS),
  "town-weekly-off-podium": () => renderLeagueWeeklyEmail({ ...WEEK, me: { rank: 5, login: "zappymanwho", total: 90 } }, PREVIEW_LINKS),
  "town-weekly-no-winner": () =>
    renderLeagueWeeklyEmail(
      {
        ...WEEK,
        standings: WEEK.standings.map((s) => ({ ...s, rank: 1, total: 0 })),
        me: { rank: 1, login: "srizzon", total: 0 },
        winnerLogin: null,
        townLine: null,
      },
      PREVIEW_LINKS,
    ),
  "town-invited": () =>
    renderLeagueInvitedEmail(
      { ...TOWN, inviterLogin: "srizzon", link: "https://thegitcity.com/town/ship-city?ref=srizzon&invite=pedrohenrique" },
      PREVIEW_LINKS,
    ),
  "town-join-request": () => renderJoinRequestEmail({ ...TOWN, requesterLogin: "mrousavy" }, PREVIEW_LINKS),
  "town-request-approved": () => renderRequestApprovedEmail({ ...TOWN, adminLogin: "srizzon" }, PREVIEW_LINKS),
  "purchase-cosmetic": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "neon_outline", price: { amountCents: 100, currency: "PX" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "purchase-pixels-freeze": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "streak_freeze", price: { amountCents: 120, currency: "PX" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "purchase-raid-item": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "raid_rocket", price: { amountCents: 300, currency: "PX" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "gift-sent": () =>
    renderGiftSentEmail({ receiverLogin: "pyromains", itemId: "lightning_aura", price: { amountCents: 300, currency: "PX" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "gift-received": () => renderGiftReceivedEmail({ giverLogin: "srizzon", receiverLogin: "pyromains", itemId: "lightning_aura" }, PREVIEW_LINKS),
  "gift-received-raid-item": () => renderGiftReceivedEmail({ giverLogin: "srizzon", receiverLogin: "pyromains", itemId: "tag_gold" }, PREVIEW_LINKS),
};
