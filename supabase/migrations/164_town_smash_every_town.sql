-- ─── Smash in every town ───────────────────────────────────
-- Anyone signed in can knock down any building in any town but their own
-- (src/lib/league-city/smash.ts). Two additions to 160:
--
-- shield_until: a building that fell can't be hit again until then (12h), so
-- nobody keeps a small town flat. A row can now be a building back to full
-- floors whose shield still runs; it goes away on the next save after that.
--
-- town_demolitions: every fall, append-only. Who knocked whom down, where and
-- when: the "@x hit you back" email reads it (did the victim knock the
-- attacker down first?). The drive room may resend a save that failed, so a
-- fall is keyed by (town, victim, fell_at) and a resend inserts nothing.

BEGIN;

ALTER TABLE public.town_building_damage ADD COLUMN IF NOT EXISTS shield_until timestamptz;

CREATE TABLE IF NOT EXISTS public.town_demolitions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_id    uuid        NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  victim_id    bigint      NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  attacker_id  bigint      NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  fell_at      timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (victim_id <> attacker_id),
  UNIQUE (league_id, victim_id, fell_at)
);

-- "Did @victim knock @attacker down lately?"
CREATE INDEX IF NOT EXISTS town_demolitions_pair_idx ON public.town_demolitions (victim_id, attacker_id, fell_at DESC);

-- RLS on, no public policies: reads and writes go through the service role.
ALTER TABLE public.town_demolitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.town_demolitions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.town_demolitions TO service_role;

COMMIT;
