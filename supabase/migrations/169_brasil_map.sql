-- The Brasil town: a town drawn as the map of Brazil, where each member lives
-- in their state's city (src/lib/towns/brasil-map.ts).
--
-- leagues.map picks how a town is drawn: null is the town's own lot grid,
-- 'brasil' the map. brasil_residents keeps every resident's lot, chosen once
-- when they arrive and never recomputed, so nobody's building ever moves:
-- their state (null: the island), which of the state's cities (hub: 0 the
-- capital, 1 its second city, 9 the island), the lot, and how they came. A
-- lot has one owner (two arrivals at once can't share it). brasil_comments
-- logs every comment imported from Instagram with what came of it, so a
-- comment is never imported twice.

BEGIN;

ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS map text CHECK (map IN ('brasil'));

-- A comment on the reel puts a dev in the town: they joined "via instagram".
ALTER TABLE public.league_members DROP CONSTRAINT IF EXISTS league_members_joined_via_check;
ALTER TABLE public.league_members ADD CONSTRAINT league_members_joined_via_check
  CHECK (joined_via IS NULL OR joined_via IN ('invite', 'link', 'request', 'open', 'org', 'instagram'));

CREATE TABLE IF NOT EXISTS public.brasil_residents (
  league_id    uuid        NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  developer_id bigint      NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  uf           text        CHECK (uf ~ '^[A-Z]{2}$'),
  hub          smallint    NOT NULL CHECK (hub IN (0, 1, 9)),
  x            integer     NOT NULL,
  z            integer     NOT NULL,
  source       text        NOT NULL CHECK (source IN ('site', 'instagram', 'admin')),
  placed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, developer_id),
  UNIQUE (league_id, x, z)
);
CREATE INDEX IF NOT EXISTS brasil_residents_placed ON public.brasil_residents (league_id, placed_at);

CREATE TABLE IF NOT EXISTS public.brasil_comments (
  id           text        PRIMARY KEY,
  reel         text        NOT NULL,
  ig_user      text,
  github_login text,
  uf           text,
  developer_id bigint      REFERENCES public.developers(id) ON DELETE SET NULL,
  outcome      text        NOT NULL CHECK (outcome IN ('added', 'already', 'moved', 'unknown_user', 'no_login', 'blocked', 'capped')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brasil_comments_reel ON public.brasil_comments (reel, created_at);

-- RLS on, no public policies: reads and writes go through the service role.
ALTER TABLE public.brasil_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brasil_comments  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brasil_residents, public.brasil_comments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brasil_residents, public.brasil_comments TO service_role;

UPDATE public.leagues SET map = 'brasil' WHERE slug = 'brasil-town';

COMMIT;

NOTIFY pgrst, 'reload schema';
