// Every email Git City sends, for the admin (/admin/emails). `types` are the
// notification_log types the engine writes; empty means a direct send
// (landmark owners, internal) that isn't logged there. `previews` are
// keys in src/lib/email/previews.

export type EmailArea = "game" | "towns" | "shop" | "ads" | "campaigns";
export type EmailSender = "notify" | "mail";

export interface CatalogEmail {
  name: string;
  area: EmailArea;
  trigger: string;
  audience: string;
  /** Preference category that controls it; "transactional" can't be turned off. */
  category: string;
  sender: EmailSender;
  types: string[];
  previews: string[];
  source: string;
}

export const EMAIL_AREAS: { key: EmailArea; label: string }[] = [
  { key: "game", label: "Game" },
  { key: "towns", label: "Towns" },
  { key: "shop", label: "Shop" },
  { key: "ads", label: "Landmarks" },
  { key: "campaigns", label: "Campaigns" },
];

export const EMAIL_CATALOG: CatalogEmail[] = [
  // Game
  { name: "Welcome", area: "game", trigger: "A player claims their building", audience: "Players", category: "transactional", sender: "notify", types: ["welcome"], previews: ["welcome-sample"], source: "notification-senders/welcome.ts" },
  { name: "Raid alert", area: "game", trigger: "Someone raids your building", audience: "Players", category: "social", sender: "mail", types: ["raid_alert"], previews: ["raid-tagged", "raid-defended"], source: "notification-senders/raid.ts" },
  { name: "Raid digest", area: "game", trigger: "Several raids bundled (Bundled setting, or over the email cap)", audience: "Players", category: "social", sender: "mail", types: ["raid_alert_digest"], previews: ["digest-raids", "digest-raids-held"], source: "notifications.ts" },
  { name: "Weekly recap", area: "game", trigger: "Mondays 10:00 UTC, active in 30 days with news", audience: "Players", category: "digest", sender: "mail", types: ["weekly_digest"], previews: ["recap-busy", "recap-quiet"], source: "notification-senders/weekly-recap.ts" },
  { name: "Daily reminder", area: "game", trigger: "20:00 UTC: streak alive but no check-in, or missions half done", audience: "Players", category: "streak_reminders", sender: "mail", types: ["streak_reminder", "dailies_reminder"], previews: ["daily-streak-no-freeze", "daily-streak-freeze", "daily-streak-last-chance", "daily-missions"], source: "notification-senders/daily-reminder.ts" },
  { name: "Streak milestone", area: "game", trigger: "Streak reaches 30, 100 or 365 days", audience: "Players", category: "social", sender: "mail", types: ["streak_milestone"], previews: ["streak-milestone-30", "streak-milestone-100", "streak-milestone-365-record"], source: "notification-senders/streak.ts" },
  { name: "Streak broken", area: "game", trigger: "A check-in resets a streak", audience: "Players", category: "streak_reminders", sender: "mail", types: ["streak_broken"], previews: ["streak-broken"], source: "notification-senders/streak-broken.ts" },
  { name: "Emblem earned", area: "game", trigger: "A gold or diamond emblem", audience: "Players", category: "social", sender: "mail", types: ["emblem_earned", "emblem_earned_digest"], previews: ["emblem-single", "emblem-multiple", "digest-emblems"], source: "notification-senders/emblem.ts" },
  { name: "Referral joined", area: "game", trigger: "Someone claims through your invite link", audience: "Players", category: "social", sender: "mail", types: ["referral_joined"], previews: ["referral-joined"], source: "notification-senders/referral.ts" },
  { name: "Comeback", area: "game", trigger: "Daily 14:00 UTC, 7/14/30 days away (opt-in)", audience: "Players", category: "marketing", sender: "mail", types: ["re_engagement"], previews: ["re-engagement-7d-kudos", "re-engagement-14d", "re-engagement-30d"], source: "notification-senders/re-engagement.ts" },

  // Towns
  { name: "Town invite", area: "towns", trigger: "A member invites you to their town", audience: "Players", category: "leagues", sender: "mail", types: ["league_invited"], previews: ["town-invited"], source: "notification-senders/league-invited.ts" },
  { name: "Join request", area: "towns", trigger: "Someone asks to join your town", audience: "Town admins", category: "leagues", sender: "mail", types: ["league_join_request"], previews: ["town-join-request"], source: "notification-senders/league-requests.ts" },
  { name: "Request approved", area: "towns", trigger: "Your join request is accepted", audience: "Players", category: "leagues", sender: "mail", types: ["league_request_approved"], previews: ["town-request-approved"], source: "notification-senders/league-requests.ts" },
  { name: "Invitee joined", area: "towns", trigger: "Someone you invited joins", audience: "Players", category: "leagues", sender: "mail", types: ["league_joined"], previews: ["town-joined"], source: "notification-senders/league-joined.ts" },
  { name: "Overtaken", area: "towns", trigger: "Hourly: a member passes you in the week's race", audience: "Town members", category: "leagues", sender: "mail", types: ["league_overtaken"], previews: ["town-overtaken", "town-overtaken-last-hours"], source: "notification-senders/league-overtaken.ts" },
  { name: "Weekly result", area: "towns", trigger: "Monday 00:05 UTC, the week closes", audience: "Town members", category: "leagues", sender: "mail", types: ["league_weekly"], previews: ["town-weekly-won", "town-weekly-lost", "town-weekly-no-winner"], source: "notification-senders/league-weekly.ts" },
  { name: "Building knocked down", area: "towns", trigger: "A rival smashes your building", audience: "Rivalry members", category: "leagues", sender: "mail", types: ["town_demolished"], previews: ["town-demolished"], source: "notification-senders/town-demolished.ts" },
  { name: "Race: spot taken", area: "towns", trigger: "Someone beats your lap on the town track", audience: "Town members", category: "leagues", sender: "mail", types: ["race_passed"], previews: ["race-passed"], source: "notification-senders/race.ts" },
  { name: "Race challenge", area: "towns", trigger: "Someone challenges you on the track", audience: "Town members", category: "leagues", sender: "mail", types: ["race_challenge"], previews: ["race-challenge"], source: "notification-senders/race.ts" },

  // Shop
  { name: "Purchase receipt", area: "shop", trigger: "A shop purchase (card, PIX, crypto, pixels)", audience: "Buyers", category: "transactional", sender: "notify", types: ["purchase_confirmation"], previews: ["purchase-card", "purchase-pix", "purchase-pixels-freeze"], source: "notification-senders/purchase.ts" },
  { name: "Gift sent", area: "shop", trigger: "You buy a gift for someone", audience: "Buyers", category: "transactional", sender: "notify", types: ["gift_sent"], previews: ["gift-sent"], source: "notification-senders/purchase.ts" },
  { name: "Gift received", area: "shop", trigger: "Someone gifts you an item", audience: "Players", category: "social", sender: "mail", types: ["gift_received"], previews: ["gift-received"], source: "notification-senders/gift.ts" },

  // Landmarks (direct sends)
  { name: "Landmark welcome", area: "ads", trigger: "Admin sends it from Landmarks", audience: "Landmark owners", category: "transactional", sender: "notify", types: [], previews: ["ad-landmark-welcome"], source: "landmarks/welcome-email.ts" },

  // Campaigns
  { name: "Towns launch", area: "campaigns", trigger: "Admin campaign, sent in waves", audience: "Players by activity", category: "product_news", sender: "mail", types: ["campaign_towns_launch"], previews: ["campaign-towns-launch", "campaign-towns-launch-repermission"], source: "campaigns/towns-launch.ts" },
];
