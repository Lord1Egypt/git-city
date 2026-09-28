-- ─── PX economy without payments ───────────────────────────
-- Git City stopped taking real money, so PX has to come from playing and
-- coding. Target: ~40 PX on an active day plus a weekly bonus (~330 PX a
-- week), so a mid item unlocks weekly and a legendary in about four weeks.
-- Spec: docs/superpowers/specs/2026-09-27-no-payments-design.md

-- ─── Wallet sources: + play, weekly_bonus, welcome, arcade_milestone ──
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_source_check
  CHECK (source IN (
    'purchase',
    'daily_commit',
    'streak_bonus',
    'achievement',
    'city_action',
    'item_purchase',
    'refund',
    'chargeback',
    'adjustment',
    'event_reward',
    'social',
    'league_reward',
    'play',
    'weekly_bonus',
    'welcome',
    'arcade_milestone'
  ));

-- ─── Earn rules ────────────────────────────────────────────
UPDATE public.earn_rules SET pixels = 15 WHERE id = 'dailies_complete';
UPDATE public.earn_rules SET pixels = 10, max_per_day = 1 WHERE id = 'daily_commit';
UPDATE public.earn_rules SET pixels = 5, source = 'play', max_per_day = 1 WHERE id = 'raid_attack';

INSERT INTO public.earn_rules (id, source, pixels, cooldown_hours, max_per_day, description) VALUES
  ('checkin',      'city_action',  5,   20,   1,    'Daily check-in'),
  ('play_drive',   'play',         5,   20,   1,    'Drove around a town'),
  ('play_fly',     'play',         5,   20,   1,    'Flew over the city'),
  ('play_arcade',  'play',         5,   20,   1,    'Played an arcade game'),
  ('dailies_week', 'weekly_bonus', 50,  144,  1,    'Finished the dailies 7 days in a row'),
  ('welcome',      'welcome',      100, NULL, 1,    'Welcome to Git City')
ON CONFLICT (id) DO UPDATE SET
  source = EXCLUDED.source,
  pixels = EXCLUDED.pixels,
  cooldown_hours = EXCLUDED.cooldown_hours,
  max_per_day = EXCLUDED.max_per_day,
  description = EXCLUDED.description,
  is_active = true;

-- ─── earn_pixels: global cap 50 → 70, play capped at 10 a day ──
-- Same body as 052, two changes: the global cap is 70 so a 30-day streak day
-- (check-in 5 + dailies 15 + commit 10 + streak 35 = 65) still pays in full,
-- and the new 'play' source has its own 10 PX daily cap outside it.
CREATE OR REPLACE FUNCTION public.earn_pixels(
  p_developer_id bigint,
  p_earn_rule_id text,
  p_reference_id text DEFAULT NULL::text,
  p_reference_type text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule earn_rules%ROWTYPE;
  v_earned_today bigint;
  v_source_today int;
  v_last_earn timestamptz;
  v_old_balance bigint;
  v_new_balance bigint;
  v_tx_id uuid;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'earn_pixels requires service_role';
  END IF;

  PERFORM pg_advisory_xact_lock(p_developer_id);

  SELECT * INTO v_rule FROM earn_rules WHERE id = p_earn_rule_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_earn_rule');
  END IF;

  -- Check cooldown
  IF v_rule.cooldown_hours IS NOT NULL THEN
    SELECT MAX(created_at) INTO v_last_earn
    FROM wallet_transactions
    WHERE developer_id = p_developer_id
      AND source = v_rule.source
      AND reference_type = p_earn_rule_id
      AND created_at >= now() - make_interval(hours => v_rule.cooldown_hours);

    IF v_last_earn IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;
  END IF;

  -- Check per-source daily limit
  IF v_rule.max_per_day IS NOT NULL THEN
    SELECT COUNT(*) INTO v_source_today
    FROM wallet_transactions
    WHERE developer_id = p_developer_id
      AND source = v_rule.source
      AND reference_type = p_earn_rule_id
      AND created_at >= now() - interval '24 hours';

    IF v_source_today >= v_rule.max_per_day THEN
      RETURN jsonb_build_object('error', 'daily_source_cap_reached');
    END IF;
  END IF;

  -- Check global daily earn cap (70 PX)
  IF v_rule.source IN ('daily_commit', 'streak_bonus', 'achievement', 'city_action') THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_earned_today
    FROM wallet_transactions
    WHERE developer_id = p_developer_id
      AND type = 'credit'
      AND source IN ('daily_commit', 'streak_bonus', 'achievement', 'city_action')
      AND created_at >= now() - interval '24 hours';

    IF v_earned_today + v_rule.pixels > 70 THEN
      RETURN jsonb_build_object('error', 'daily_earn_cap_reached');
    END IF;
  END IF;

  -- Check the play cap (10 PX across drive, fly, raid and arcade)
  IF v_rule.source = 'play' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_earned_today
    FROM wallet_transactions
    WHERE developer_id = p_developer_id
      AND type = 'credit'
      AND source = 'play'
      AND created_at >= now() - interval '24 hours';

    IF v_earned_today + v_rule.pixels > 10 THEN
      RETURN jsonb_build_object('error', 'daily_earn_cap_reached');
    END IF;
  END IF;

  INSERT INTO wallets (developer_id)
  VALUES (p_developer_id)
  ON CONFLICT (developer_id) DO NOTHING;

  UPDATE wallets
  SET balance = balance + v_rule.pixels,
      lifetime_earned = lifetime_earned + v_rule.pixels,
      updated_at = now()
  WHERE developer_id = p_developer_id
  RETURNING balance - v_rule.pixels, balance
  INTO v_old_balance, v_new_balance;

  INSERT INTO wallet_transactions (
    developer_id, type, amount, source,
    reference_id, reference_type, description,
    balance_before, balance_after,
    idempotency_key
  ) VALUES (
    p_developer_id, 'credit', v_rule.pixels, v_rule.source,
    p_reference_id, p_earn_rule_id, v_rule.description,
    v_old_balance, v_new_balance,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    UPDATE wallets
    SET balance = balance - v_rule.pixels,
        lifetime_earned = lifetime_earned - v_rule.pixels,
        updated_at = now()
    WHERE developer_id = p_developer_id;

    RETURN jsonb_build_object('error', 'duplicate_transaction');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'earned', v_rule.pixels
  );
END;
$function$;

-- ─── credit_pixels: accept arcade milestones ───────────────
-- Arcade milestones pay a varying amount once per milestone, so they go
-- through credit_pixels (amount + idempotency key) rather than an earn rule.
-- Same body as prod's, one change: 'arcade_milestone' joins the allowed sources.
CREATE OR REPLACE FUNCTION public.credit_pixels(
  p_developer_id bigint,
  p_amount bigint,
  p_source text,
  p_reference_id text,
  p_reference_type text,
  p_description text,
  p_idempotency_key text,
  p_ip inet DEFAULT NULL::inet,
  p_user_agent text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_balance bigint;
  v_new_balance bigint;
  v_tx_id uuid;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'credit_pixels requires service_role';
  END IF;

  IF p_source NOT IN ('purchase', 'refund', 'adjustment', 'arcade_milestone') THEN
    RAISE EXCEPTION 'credit_pixels only accepts purchase/refund/adjustment/arcade_milestone sources';
  END IF;

  PERFORM pg_advisory_xact_lock(p_developer_id);

  INSERT INTO wallets (developer_id)
  VALUES (p_developer_id)
  ON CONFLICT (developer_id) DO NOTHING;

  UPDATE wallets
  SET balance = balance + p_amount,
      lifetime_bought = lifetime_bought +
        CASE WHEN p_source = 'purchase' THEN p_amount ELSE 0 END,
      lifetime_earned = lifetime_earned +
        CASE WHEN p_source != 'purchase' THEN p_amount ELSE 0 END,
      updated_at = now()
  WHERE developer_id = p_developer_id
  RETURNING balance - p_amount, balance
  INTO v_old_balance, v_new_balance;

  INSERT INTO wallet_transactions (
    developer_id, type, amount, source,
    reference_id, reference_type, description,
    balance_before, balance_after,
    idempotency_key, ip_address, user_agent
  ) VALUES (
    p_developer_id, 'credit', p_amount, p_source,
    p_reference_id, p_reference_type, p_description,
    v_old_balance, v_new_balance,
    p_idempotency_key, p_ip, p_user_agent
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    UPDATE wallets
    SET balance = balance - p_amount,
        lifetime_bought = lifetime_bought -
          CASE WHEN p_source = 'purchase' THEN p_amount ELSE 0 END,
        lifetime_earned = lifetime_earned -
          CASE WHEN p_source != 'purchase' THEN p_amount ELSE 0 END,
        updated_at = now()
    WHERE developer_id = p_developer_id;

    RETURN jsonb_build_object('error', 'duplicate_transaction');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance
  );
END;
$function$;

-- ─── Items that only had a USD price ───────────────────────
UPDATE public.items SET price_pixels = 300 WHERE id = 'tag_fire' AND price_pixels IS NULL;
