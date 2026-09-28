-- ─── Email campaigns and consent ──────────────────────────
-- Product-news email sent in waves, and a record of every consent change.
-- Additive only: no existing row is touched.
--
-- 1. notification_preferences.product_news: launches and big features, on by
--    default (legitimate interest; opt out from any email or Settings). The
--    old `marketing` column defaults to false for everyone, so it can't tell
--    an opt-out from a default and is left alone.
-- 2. consent_events: append-only log of every opt-in, opt-out, notice shown,
--    complaint and hard bounce, with where it came from.
-- 3. campaigns + campaign_recipients: one row per announcement, and its
--    audience frozen when the campaign is built (one row per developer, so
--    nobody gets the same campaign twice). Holdout rows are never sent.
-- All three tables are service-role only.

BEGIN;

-- 1 ─ product news preference
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS product_news boolean NOT NULL DEFAULT true;

-- 2 ─ consent log
CREATE TABLE IF NOT EXISTS public.consent_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  developer_id  bigint NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  topic         text   NOT NULL,              -- a preference column name, or 'all'
  action        text   NOT NULL CHECK (action IN ('subscribed', 'unsubscribed', 'notice_shown', 'confirmed')),
  source        text   NOT NULL CHECK (source IN ('one_click', 'preference_page', 'settings', 'notice', 'signup', 'complaint', 'bounce', 'sunset', 'admin')),
  campaign_id   bigint,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_events_dev ON public.consent_events (developer_id, created_at DESC);

-- 3 ─ campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text   NOT NULL UNIQUE,       -- template key in src/lib/campaigns/registry.ts
  topic         text   NOT NULL DEFAULT 'product_news',
  status        text   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'paused', 'done')),
  pause_reason  text,
  holdout_pct   smallint NOT NULL DEFAULT 2 CHECK (holdout_pct BETWEEN 0 AND 50),
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  campaign_id   bigint NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  developer_id  bigint NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  cohort        text   NOT NULL,              -- active30 | active90 | active180 | dormant
  variant       text   NOT NULL,              -- a template variant, or 'holdout'
  send_after    timestamptz NOT NULL,
  status        text   NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'skipped', 'failed', 'holdout')),
  skip_reason   text,
  attempts      smallint NOT NULL DEFAULT 0,
  sent_at       timestamptz,
  PRIMARY KEY (campaign_id, developer_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_due
  ON public.campaign_recipients (campaign_id, send_after) WHERE status = 'queued';

-- Service role only
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consent_events, public.campaigns, public.campaign_recipients FROM anon, authenticated;

COMMIT;
