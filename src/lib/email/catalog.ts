// Every email Git City sends, for the admin (/admin/emails). `types` are the
// notification_log types the engine writes; empty means a direct send
// (companies, advertisers, internal) that isn't logged there. `previews` are
// keys in src/lib/email/previews.

export type EmailArea = "game" | "towns" | "shop" | "jobs" | "companies" | "ads" | "internal" | "campaigns";
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
  { key: "jobs", label: "Jobs" },
  { key: "companies", label: "Companies" },
  { key: "ads", label: "Advertisers" },
  { key: "internal", label: "Internal" },
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

  // Jobs (developers)
  { name: "Application sent", area: "jobs", trigger: "You apply to a job", audience: "Developers", category: "transactional", sender: "notify", types: ["job_application_confirmed"], previews: ["job-application-confirmed"], source: "notification-senders/job-application-confirmed.ts" },
  { name: "Hired", area: "jobs", trigger: "A company marks you hired", audience: "Developers", category: "transactional", sender: "notify", types: ["job_hired"], previews: ["job-hired"], source: "notification-senders/job-hired.ts" },
  { name: "Position filled", area: "jobs", trigger: "A job you applied to is filled", audience: "Developers", category: "jobs_updates", sender: "mail", types: ["job_filled", "job_filled_digest"], previews: ["job-filled", "digest-jobs-filled"], source: "notification-senders/job-filled.ts" },
  { name: "Weekly job matches", area: "jobs", trigger: "Mondays 11:00 UTC", audience: "Developers", category: "jobs_digest", sender: "mail", types: ["job_digest"], previews: ["job-digest"], source: "notification-senders/job-digest.ts" },
  { name: "Profile nudge", area: "jobs", trigger: "Your 3rd application", audience: "Developers", category: "jobs_updates", sender: "mail", types: ["job_profile_nudge"], previews: ["job-profile-nudge"], source: "notification-senders/job-profile-nudge.ts" },
  { name: "Referral posted a job", area: "jobs", trigger: "A company you referred goes live", audience: "Developers", category: "jobs_updates", sender: "mail", types: ["job_referral_converted"], previews: ["job-referral-converted"], source: "notification-senders/job-referral-converted.ts" },
  { name: "Jobs launched", area: "jobs", trigger: "Daily 12:00 UTC, for jobs waitlist signups", audience: "Developers", category: "transactional", sender: "notify", types: ["job_notify_fulfilled"], previews: ["job-notify-signup"], source: "notification-senders/job-notify-signup.ts" },

  // Companies (direct sends)
  { name: "Company welcome", area: "companies", trigger: "Admin creates a company account", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-company-welcome"], source: "notification-senders/job-company-welcome.ts" },
  { name: "Listing approved", area: "companies", trigger: "Admin approves a listing", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-approved"], source: "notification-senders/job-approved.ts" },
  { name: "Listing rejected", area: "companies", trigger: "Admin rejects a listing", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-rejected"], source: "notification-senders/job-rejected.ts" },
  { name: "Listing paused", area: "companies", trigger: "10 reports auto-pause a listing", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-reported"], source: "notification-senders/job-reported.ts" },
  { name: "New candidate", area: "companies", trigger: "Every 15 min, new applications", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-application-received", "job-applications-batch"], source: "notification-senders/job-application-received.ts" },
  { name: "Listing ending / ended", area: "companies", trigger: "Daily 09:00 UTC", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-expiring", "job-expired"], source: "notification-senders/job-expiry.ts" },
  { name: "Weekly jobs report", area: "companies", trigger: "Mondays 10:00 UTC", audience: "Companies", category: "transactional", sender: "notify", types: [], previews: ["job-weekly-report"], source: "notification-senders/job-performance-report.ts" },

  // Advertisers (direct sends)
  { name: "Ad ending", area: "ads", trigger: "Every 6h, 2 days before an ad ends", audience: "Advertisers", category: "transactional", sender: "notify", types: [], previews: ["ad-expiring"], source: "ad-emails.ts" },
  { name: "Ad results", area: "ads", trigger: "When an ad ends", audience: "Advertisers", category: "transactional", sender: "notify", types: [], previews: ["ad-expired"], source: "ad-emails.ts" },
  { name: "Ad follow-ups", area: "ads", trigger: "7 and 30 days after an ad ends", audience: "Advertisers", category: "marketing", sender: "mail", types: [], previews: ["ad-followup-7d", "ad-followup-30d"], source: "ad-emails.ts" },
  { name: "Weekly ads report", area: "ads", trigger: "Mondays 10:00 UTC", audience: "Advertisers", category: "transactional", sender: "mail", types: [], previews: ["ad-weekly-report"], source: "notification-senders/ad-report.ts" },
  { name: "Business sign-in link", area: "ads", trigger: "Sign-in on /business/login", audience: "Advertisers and companies", category: "transactional", sender: "notify", types: [], previews: ["ad-sign-in"], source: "api/ads/auth/send-magic-link" },
  { name: "Landmark welcome", area: "ads", trigger: "Admin sends it from Landmarks", audience: "Landmark owners", category: "transactional", sender: "notify", types: [], previews: ["ad-landmark-welcome"], source: "landmarks/welcome-email.ts" },

  // Internal
  { name: "Listing to review", area: "internal", trigger: "A company submits a listing", audience: "Admins", category: "transactional", sender: "notify", types: [], previews: ["job-pending-review"], source: "notification-senders/job-pending-review.ts" },
  { name: "Listing auto-paused", area: "internal", trigger: "10 reports on a listing", audience: "Admins", category: "transactional", sender: "notify", types: [], previews: ["job-reported-admin"], source: "notification-senders/job-reported.ts" },
  { name: "Ad sale", area: "internal", trigger: "Stripe checkout for ads or landmarks", audience: "Owner", category: "transactional", sender: "notify", types: [], previews: ["admin-ad-sale", "admin-ad-sale-landmark"], source: "admin-emails.ts" },
  { name: "Landmark / sponsorship inquiry", area: "internal", trigger: "Contact forms on /advertise and /sponsorship", audience: "Owner", category: "transactional", sender: "notify", types: [], previews: ["admin-landmark-inquiry", "admin-sponsorship-inquiry"], source: "admin-emails.ts" },

  // Campaigns
  { name: "Towns launch", area: "campaigns", trigger: "Admin campaign, sent in waves", audience: "Players by activity", category: "product_news", sender: "mail", types: ["campaign_towns_launch"], previews: ["campaign-towns-launch", "campaign-towns-launch-repermission"], source: "campaigns/towns-launch.ts" },
];
