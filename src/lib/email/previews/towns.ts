import { renderGiftReceivedEmail } from "../../notification-senders/gift";
import { renderLeagueInvitedEmail } from "../../notification-senders/league-invited";
import { renderLeagueJoinedEmail } from "../../notification-senders/league-joined";
import { renderLeagueOvertakenEmail } from "../../notification-senders/league-overtaken";
import { renderTownDemolishedEmail } from "../../notification-senders/town-demolished";
import { renderRaceChallengeEmail, renderRacePassedEmail } from "../../notification-senders/race";
import { renderJoinRequestEmail, renderRequestApprovedEmail } from "../../notification-senders/league-requests";
import { renderLeagueWeeklyEmail, type LeagueWeeklyEmailData } from "../../notification-senders/league-weekly";
import { renderGiftSentEmail, renderPurchaseEmail } from "../../notification-senders/purchase";
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

// Sample renders for the admin preview (?template=<key>) and test sends.
export const TOWNS_PREVIEWS: EmailPreviews = {
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
    renderTownDemolishedEmail({ leagueSlug: "codex-town", leagueName: "Codex Town", attackerLogin: "srizzon" }, PREVIEW_LINKS),
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
  "purchase-card": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "neon_outline", price: { amountCents: 499, currency: "usd" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "purchase-pix": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "crown_item", price: { amountCents: 2490, currency: "brl" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "purchase-pixels-freeze": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "streak_freeze", price: { amountCents: 120, currency: "PX" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "purchase-raid-item": () =>
    renderPurchaseEmail({ login: "srizzon", itemId: "raid_rocket", price: { amountCents: 300, currency: "PX" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "gift-sent": () =>
    renderGiftSentEmail({ receiverLogin: "pyromains", itemId: "lightning_aura", price: { amountCents: 299, currency: "usd" }, date: DATE }, TRANSACTIONAL_PREVIEW_LINKS),
  "gift-received": () => renderGiftReceivedEmail({ giverLogin: "srizzon", receiverLogin: "pyromains", itemId: "lightning_aura" }, PREVIEW_LINKS),
  "gift-received-raid-item": () => renderGiftReceivedEmail({ giverLogin: "srizzon", receiverLogin: "pyromains", itemId: "tag_gold" }, PREVIEW_LINKS),
};
