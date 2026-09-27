-- ─── Rivalry smash: saved building damage ──────────────────
-- A dev on one side of the rivalry drives through the other town's buildings
-- and knocks their floors out (src/lib/league-city/smash.ts). The PartyKit
-- drive room decides every floor and saves the damaged buildings here through
-- /api/towns/[slug]/smash (signed). One row per damaged building; a building
-- back to full has no row.
--
-- Floors grow back without a cron: whoever reads a row adds one floor per hour
-- since regen_from, and one per contribution the owner made this week beyond
-- contrib_base.

BEGIN;

CREATE TABLE IF NOT EXISTS public.town_building_damage (
  league_id     uuid     NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  developer_id  bigint   NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  -- Floors left per column (up to a 4 × 4 grid of columns).
  rows          smallint[] NOT NULL CHECK (cardinality(rows) BETWEEN 1 AND 16 AND 0 <= ALL (rows) AND 200 >= ALL (rows)),
  regen_from    timestamptz NOT NULL DEFAULT now(),
  contrib_base  int      NOT NULL DEFAULT 0 CHECK (contrib_base >= 0),
  -- Who took the last floor, while the building lies in rubble.
  demolished_by bigint   REFERENCES public.developers(id) ON DELETE SET NULL,
  demolished_at timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, developer_id)
);

-- RLS on, no public policies: reads and writes go through the service role.
ALTER TABLE public.town_building_damage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.town_building_damage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_building_damage TO service_role;

COMMIT;
