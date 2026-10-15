-- The site admin (ADMIN_GITHUB_LOGINS, checked in the route) can edit any
-- town's city, not only towns they run. apply_league_city_ops_admin_by_id gets
-- p_site_admin (default false) that skips the town admin check; the edits are
-- still logged and rate limited under the site admin's own developer id.
--
-- Prod's definition was hand-patched before (see 157), so this edits the live
-- definition in place: each anchor must appear exactly once, and a second run
-- is a no-op. The old 3-argument function is dropped so calls aren't ambiguous.

DO $$
DECLARE
  v_def text;
  c_sig_old constant text := 'apply_league_city_ops_admin_by_id(p_slug text, p_dev_id bigint, p_ops jsonb)';
  c_sig_new constant text := 'apply_league_city_ops_admin_by_id(p_slug text, p_dev_id bigint, p_ops jsonb, p_site_admin boolean DEFAULT false)';
  c_chk_old constant text := 'IF v_dev IS NULL OR v_admin IS DISTINCT FROM v_dev THEN';
  c_chk_new constant text := 'IF v_dev IS NULL OR (v_admin IS DISTINCT FROM v_dev AND NOT p_site_admin) THEN';
BEGIN
  IF to_regprocedure('public.apply_league_city_ops_admin_by_id(text, bigint, jsonb, boolean)') IS NOT NULL THEN
    RETURN;
  END IF;
  v_def := pg_get_functiondef('public.apply_league_city_ops_admin_by_id(text, bigint, jsonb)'::regprocedure);
  IF (length(v_def) - length(replace(v_def, c_sig_old, ''))) / length(c_sig_old) <> 1 THEN
    RAISE EXCEPTION 'apply_league_city_ops_admin_by_id: signature anchor not found exactly once';
  END IF;
  IF (length(v_def) - length(replace(v_def, c_chk_old, ''))) / length(c_chk_old) <> 1 THEN
    RAISE EXCEPTION 'apply_league_city_ops_admin_by_id: admin check anchor not found exactly once';
  END IF;
  DROP FUNCTION public.apply_league_city_ops_admin_by_id(text, bigint, jsonb);
  EXECUTE replace(replace(v_def, c_sig_old, c_sig_new), c_chk_old, c_chk_new);
END
$$;

REVOKE EXECUTE ON FUNCTION public.apply_league_city_ops_admin_by_id(text, bigint, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_league_city_ops_admin_by_id(text, bigint, jsonb, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
