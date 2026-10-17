-- The Brasil town listens to Instagram: a comment on a watched reel reaches
-- the webhook (src/app/api/instagram/webhook) and puts its dev on the map.
--
-- brasil_reels lists the posts whose comments count (picked in the admin, so
-- a comment on any other post never adds anyone). instagram_account keeps the
-- one connected account and its long-lived token, which the daily cron
-- refreshes before its 60 days run out. brasil_comments.replied_at marks the
-- comments answered on Instagram, so a retried webhook never replies twice.

BEGIN;

CREATE TABLE IF NOT EXISTS public.brasil_reels (
  media_id   text        PRIMARY KEY,
  permalink  text,
  caption    text,
  watching   boolean     NOT NULL DEFAULT true,
  added_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instagram_account (
  id           smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ig_user_id   text,
  username     text,
  access_token text        NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

ALTER TABLE public.brasil_comments ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- RLS on, no public policies: only the service role reads or writes them.
ALTER TABLE public.brasil_reels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_account ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brasil_reels, public.instagram_account FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brasil_reels, public.instagram_account TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
