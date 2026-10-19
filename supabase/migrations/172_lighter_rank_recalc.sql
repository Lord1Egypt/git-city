-- recalculate_ranks already skips unchanged rows, but one new dev near the top
-- shifts everyone below, so each run still rewrites most of developers and
-- leaves that many dead rows (2026-10-18 outage: the table outgrew the db's
-- memory). Run it once a day at 07:00 UTC (04:00 in Brazil, the quietest
-- hour) instead of every 8h; new devs keep their provisional rank
-- (assign_new_dev_rank) until then.

SELECT cron.unschedule('recalculate-ranks');
SELECT cron.schedule('recalculate-ranks', '0 7 * * *', 'SELECT recalculate_ranks()');

-- pg_cron's run log was never pruned (330k rows, 250 MB, a row a minute from
-- cleanup-sessions alone): keep a week of it.
SELECT cron.schedule(
  'prune-cron-run-log',
  '30 7 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);
