# Emails

Everything about Git City email is managed at **/admin/emails**: delivery health, every email with previews and test sends, campaigns, and dated chores.

## How a game email is sent

`sendNotification()` in `src/lib/notifications.ts` is the only gateway. For each email it checks, in order: the player's preferences, the 90-day sunset (recaps and marketing only), dedup, the frequency caps (2/hour, 3/day, 8/week for non-transactional mail; over the cap, raids and emblems roll into a digest), then sends through Resend with a throttle, retries on 429 and logs to `notification_log`. Resend webhooks update delivery, opens, clicks, bounces and complaints; hard bounces and complaints block the address.

- Templates: `src/lib/notification-senders/*.ts`, built from the blocks in `src/lib/email/components.ts` and `layout.ts`. Dark design; text goes through `gmailSafe()` so Gmail iOS dark mode doesn't invert it.
- Senders: receipts, account and sign-in mail from `noreply@notify.thegitcity.com`; everything else from `noreply@mail.thegitcity.com` (`src/lib/email/senders.ts`). Separate subdomains keep their reputations apart.
- Direct sends (companies, advertisers, internal) skip the engine and aren't in `notification_log`.

## Preferences and consent

- Topics players can turn off: `src/lib/email/topics.ts` (one list for settings, the no-login preference page and unsubscribe). A topic is a `notification_preferences` column.
- Receipts and account mail ("transactional") have no unsubscribe.
- Every email's footer links to `/email-preferences` (signed, no login) and a one-click unsubscribe for its own topic.
- Every change is appended to `consent_events` with its source (one click, preference page, settings, notice, complaint, bounce, sunset).
- Product news goes out on legitimate interest (privacy policy §3). Signed-in players see a one-time notice with a one-tap opt-out.

## Campaigns (product news)

Templates live in `src/lib/campaigns/` (for example `towns-launch.ts`). From the Campaigns tab: send yourself a test, create the campaign, build the audience (frozen by cohort with send times), then start. A cron (`/api/cron/campaign-runner`, every 5 minutes) sends what's due through the same gateway and pauses the campaign on its own above 2% bounces or 0.05% complaints. Players idle 180+ days get a permission email instead; run Sunset 14 days later to stop product news for those who didn't confirm.

## Adding an email

1. Write `renderXEmail(data, links)` next to the others and call `sendNotification({ ..., render })`.
2. Add sample renders to `src/lib/email/previews/<area>.ts`.
3. Add it to `src/lib/email/catalog.ts` so it shows in the admin.
4. Send yourself a test from the admin and check it in Gmail on an iPhone in dark mode.

## Chores

Dated tasks (DMARC, BIMI, the Gmail logo certificate, campaign sunsets) are in `src/lib/email/todos.ts` and on the To-do tab.
