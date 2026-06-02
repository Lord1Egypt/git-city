-- ─── Companion Duck variants (3-rail prestige ladder) ──────
-- One base model, three finishes — the cheapest path to tiered prestige.
--   companion_duck      common    — participation floor (vault-rotatable)
--   duck_combatant      rare      — milestone / ranked top-50%
--   duck_gold_animated  legendary — ranked top tier, NEVER returns (idle anim)
--
-- All crown-zone, so they auto-equip in the same slot. Renderer reads the
-- item id to pick the finish + animation.

BEGIN;

-- Tag the existing common duck
UPDATE items SET rarity = 'common' WHERE id = 'companion_duck';

INSERT INTO items (id, category, name, description, price_usd_cents, price_brl_cents, zone, metadata, is_active, price_pixels, rarity)
VALUES
  (
    'duck_combatant', 'structure', 'Combatant Duck',
    'A battle-scarred duck with a crimson crest. Earned by climbing the Bug Invasion leaderboard.',
    0, 0, 'crown', '{"event_reward": true, "variant_of": "companion_duck"}'::jsonb, true, NULL, 'rare'
  ),
  (
    'duck_gold_animated', 'structure', 'Golden Slayer Duck',
    'A radiant golden duck wreathed in flame. Granted only to the top defenders of a Bug Invasion. Never returns.',
    0, 0, 'crown', '{"event_reward": true, "variant_of": "companion_duck", "animated": true, "never_returns": true}'::jsonb, true, NULL, 'legendary'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
