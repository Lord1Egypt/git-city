-- ─── Drift: the global board per spot ─────────────────────────
-- Drift spots belong to no town: one board per spot for everyone.
-- - drift_runs: each driver's best score on a spot, the country it counts for,
--   and the frames of that run (the ghost others race). Only the best is kept.
-- - developers.drift_country: the country a driver's runs count for. Set from
--   the request's IP country on the first post, changeable on /drift.
-- - record_drift_run: keeps the best, returns the ranks (world and country),
--   the board's size and up to three drivers this run passed.

BEGIN;

ALTER TABLE public.developers
  ADD COLUMN IF NOT EXISTS drift_country text CHECK (drift_country IS NULL OR drift_country ~ '^[A-Z]{2}$');

CREATE TABLE IF NOT EXISTS public.drift_runs (
  spot         text   NOT NULL CHECK (spot ~ '^[a-z0-9-]{1,32}$'),
  developer_id bigint NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  score        int    NOT NULL CHECK (score >= 0 AND score < 100000000),
  runs         int    NOT NULL DEFAULT 1,
  country      text   CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  -- {frames: number[], splits: int[]} (lib/drift/frames.ts); the API caps its size.
  ghost        jsonb  NOT NULL,
  set_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (spot, developer_id)
);
CREATE INDEX IF NOT EXISTS idx_drift_runs_board ON public.drift_runs (spot, score DESC, set_at);
CREATE INDEX IF NOT EXISTS idx_drift_runs_country ON public.drift_runs (spot, country, score DESC, set_at);

-- RLS on, no public policies: reads and writes go through the service role.
ALTER TABLE public.drift_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drift_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drift_runs TO service_role;

-- ─── record_drift_run ──────────────────────────────────────
-- Counts a validated run, keeping each driver's best (and its ghost). Returns
-- the best, whether this run set it, the rank on the world board and on the
-- driver's country board (ties go to whoever set it first), how many drivers
-- each board has, and up to three drivers it passed on the world board
-- (closest first), only when it improved the best.
CREATE OR REPLACE FUNCTION public.record_drift_run(
  p_spot    text,
  p_dev_id  bigint,
  p_score   int,
  p_country text,
  p_ghost   jsonb
) RETURNS TABLE (
  best          int,
  improved      boolean,
  rank_world    int,
  rank_country  int,
  total_world   int,
  total_country int,
  passed        bigint[]
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_prev   int;
  v_best   int;
  v_set_at timestamptz;
  v_passed bigint[] := '{}';
BEGIN
  SELECT r.score INTO v_prev
  FROM public.drift_runs r
  WHERE r.spot = p_spot AND r.developer_id = p_dev_id
  FOR UPDATE;

  INSERT INTO public.drift_runs AS r (spot, developer_id, score, country, ghost)
  VALUES (p_spot, p_dev_id, p_score, p_country, p_ghost)
  ON CONFLICT (spot, developer_id) DO UPDATE
    SET runs    = r.runs + 1,
        country = EXCLUDED.country,
        score   = GREATEST(r.score, EXCLUDED.score),
        ghost   = CASE WHEN EXCLUDED.score > r.score THEN EXCLUDED.ghost ELSE r.ghost END,
        set_at  = CASE WHEN EXCLUDED.score > r.score THEN now() ELSE r.set_at END
  RETURNING r.score, r.set_at INTO v_best, v_set_at;

  IF v_prev IS NULL OR p_score > v_prev THEN
    SELECT coalesce(array_agg(o.developer_id ORDER BY o.score DESC), '{}') INTO v_passed
    FROM (
      SELECT o.developer_id, o.score
      FROM public.drift_runs o
      WHERE o.spot = p_spot AND o.developer_id <> p_dev_id
        AND o.score < v_best AND (v_prev IS NULL OR o.score >= v_prev)
      ORDER BY o.score DESC
      LIMIT 3
    ) o;
  END IF;

  RETURN QUERY
  SELECT v_best,
         (v_prev IS NULL OR p_score > v_prev),
         (SELECT count(*)::int + 1 FROM public.drift_runs o
          WHERE o.spot = p_spot AND (o.score > v_best OR (o.score = v_best AND o.set_at < v_set_at))),
         (SELECT count(*)::int + 1 FROM public.drift_runs o
          WHERE o.spot = p_spot AND o.country IS NOT DISTINCT FROM p_country
            AND (o.score > v_best OR (o.score = v_best AND o.set_at < v_set_at))),
         (SELECT count(*)::int FROM public.drift_runs o WHERE o.spot = p_spot),
         (SELECT count(*)::int FROM public.drift_runs o WHERE o.spot = p_spot AND o.country IS NOT DISTINCT FROM p_country),
         v_passed;
END;
$$;

REVOKE ALL ON FUNCTION public.record_drift_run(text, bigint, int, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_drift_run(text, bigint, int, text, jsonb) TO service_role;

COMMIT;
