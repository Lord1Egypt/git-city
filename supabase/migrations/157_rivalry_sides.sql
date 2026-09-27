-- Claude Code vs Codex (src/lib/towns/rivalry.ts).
--
-- 1. One side at a time. The app leaves the old side before joining the new
--    one, but two requests at the same instant (two tabs, a double click)
--    could each see "no side yet" and land the dev on both. This trigger
--    refuses the second, serialized per dev by an advisory lock.
--    Rows that were already on both sides before this migration stay as they
--    are; the trigger only fires when a membership becomes active.
--
-- 2. Room for everyone who picks. A side comes with a building, and a city
--    caps at h = 20 (about 1,600 lots) and 4,000 objects. The two rivalry
--    towns get h = 40 (about 6,500 lots) and 8,000 objects. Prod's
--    apply_league_city_ops was hand-patched before (134/135, 141, 145, 153),
--    so this edits the live definition in place, like 153: each anchor must
--    appear exactly once, and a second run is a no-op. The h check on
--    league_cities widens to match, and the admin editor's resize
--    (apply_league_city_ops_admin_by_id) stops clamping a bigger city to 20.

CREATE OR REPLACE FUNCTION public.league_members_one_rival_side()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rival text;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT CASE l.slug WHEN 'claude-code-town' THEN 'codex-town' WHEN 'codex-town' THEN 'claude-code-town' END
  INTO v_rival
  FROM public.leagues l
  WHERE l.id = NEW.league_id;
  IF v_rival IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('rival_side'), NEW.developer_id::int);
  IF EXISTS (
    SELECT 1
    FROM public.league_members m
    JOIN public.leagues l ON l.id = m.league_id
    WHERE l.slug = v_rival AND m.developer_id = NEW.developer_id AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'rival_side';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS league_members_one_rival_side ON public.league_members;
CREATE TRIGGER league_members_one_rival_side
  BEFORE INSERT OR UPDATE OF status ON public.league_members
  FOR EACH ROW EXECUTE FUNCTION public.league_members_one_rival_side();

DO $$
DECLARE
  v_def text;
  c_h_old constant text := 'c_max_h   constant int := 20;';
  c_h_new constant text := 'c_max_h   int := 20;';
  c_obj_old constant text := 'c_max_objects constant int := 4000;';
  c_obj_new constant text := 'c_max_objects int := 4000;';
  c_begin constant text := E'\nBEGIN\n';
  c_rivalry constant text := E'\nBEGIN\n'
    || E'  -- Claude Code vs Codex (towns/rivalry.ts RIVALRY_MAX_H): room for every dev who picks a side.\n'
    || E'  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND slug IN (''claude-code-town'', ''codex-town'')) THEN\n'
    || E'    c_max_h := 40;\n'
    || E'    c_max_objects := 8000;\n'
    || E'  END IF;\n';
BEGIN
  v_def := pg_get_functiondef('public.apply_league_city_ops(uuid, bigint, jsonb)'::regprocedure);
  IF position(c_h_new IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF (length(v_def) - length(replace(v_def, c_h_old, ''))) / length(c_h_old) <> 1
     OR (length(v_def) - length(replace(v_def, c_obj_old, ''))) / length(c_obj_old) <> 1 THEN
    RAISE EXCEPTION 'apply_league_city_ops: size anchors not found exactly once';
  END IF;
  IF position(c_begin IN v_def) = 0 THEN
    RAISE EXCEPTION 'apply_league_city_ops: body BEGIN not found';
  END IF;
  v_def := replace(v_def, c_h_old, c_h_new);
  v_def := replace(v_def, c_obj_old, c_obj_new);
  -- The first unindented BEGIN opens the function body, right after DECLARE.
  v_def := overlay(v_def PLACING c_rivalry FROM position(c_begin IN v_def) FOR length(c_begin));
  EXECUTE v_def;
END
$$;

ALTER TABLE public.league_cities DROP CONSTRAINT IF EXISTS league_cities_h_check;
ALTER TABLE public.league_cities ADD CONSTRAINT league_cities_h_check CHECK (h >= 6 AND h <= 40);

DO $$
DECLARE
  v_def text;
  c_old constant text := 'SET h = least(c_max_h, c.h + v_expands)';
  c_new constant text := 'SET h = least(greatest(c_max_h, c.h), c.h + v_expands)';
BEGIN
  v_def := pg_get_functiondef('public.apply_league_city_ops_admin_by_id'::regproc);
  IF position(c_new IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF (length(v_def) - length(replace(v_def, c_old, ''))) / length(c_old) <> 1 THEN
    RAISE EXCEPTION 'apply_league_city_ops_admin_by_id: resize anchor not found exactly once';
  END IF;
  EXECUTE replace(v_def, c_old, c_new);
END
$$;
