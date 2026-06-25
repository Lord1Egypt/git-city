-- 117_earn_rules_english_descriptions.sql
-- The earn_rules descriptions were seeded in Portuguese (migrations 052 and 105).
-- earn_pixels() copies earn_rules.description into wallet_transactions.description,
-- so every gameplay reward shows Portuguese text in the Bank > Activity ledger.
-- The product UI is English, so translate the rule descriptions. This only affects
-- NEW transactions; historical wallet_transactions rows keep their stored text.

UPDATE earn_rules SET description = 'Daily commit on GitHub'    WHERE id = 'daily_commit';
UPDATE earn_rules SET description = '3-day streak'              WHERE id = 'streak_3';
UPDATE earn_rules SET description = '7-day streak'              WHERE id = 'streak_7';
UPDATE earn_rules SET description = '14-day streak'             WHERE id = 'streak_14';
UPDATE earn_rules SET description = '30-day streak'             WHERE id = 'streak_30';
UPDATE earn_rules SET description = 'Visited the city'          WHERE id = 'visit_city';
UPDATE earn_rules SET description = 'Raid attack'              WHERE id = 'raid_attack';
UPDATE earn_rules SET description = 'Sent a gift'              WHERE id = 'gift_sent';
UPDATE earn_rules SET description = 'Completed daily tasks'     WHERE id = 'dailies_complete';
UPDATE earn_rules SET description = 'Invited a dev to the city' WHERE id = 'referral';
