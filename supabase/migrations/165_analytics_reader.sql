-- Read-only town data for PostHog's warehouse sync (the Towns dashboard).
-- The views expose only town and gameplay columns: no emails, tokens or
-- ghosts. They run as their owner, so RLS on the tables doesn't hide rows
-- from the reader. The schema isn't exposed to the API (anon/authenticated
-- get nothing). posthog_reader can read these views and nothing else; its
-- login and password are set by hand, never in a migration.

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

create or replace view analytics.towns as
  select id, slug, name, kind, join_mode, hidden, country, created_at
  from public.leagues;

create or replace view analytics.dev_logins as
  select id as developer_id, lower(github_login) as github_login
  from public.developers
  where claimed;

create or replace view analytics.town_members as
  select league_id, developer_id, status, joined_via, invited_by, joined_at, left_at
  from public.league_members;

create or replace view analytics.town_visits as
  select league_id, developer_id, day, first_at, drove
  from public.town_visits;

create or replace view analytics.town_demolitions as
  select league_id, victim_id, attacker_id, fell_at
  from public.town_demolitions;

create or replace view analytics.town_race_laps as
  select league_id, track, developer_id, best_ms, laps, set_at
  from public.town_race_laps;

create or replace view analytics.town_weekly_stats as
  select developer_id, week_start, day, contributions
  from public.league_weekly_stats;

create or replace view analytics.town_weeks as
  select league_id, week_start, winner_id, closed_at,
    (standings -> 'town' ->> 'perDev')::int as per_dev,
    (standings -> 'town' ->> 'coding')::int as coding
  from public.league_weeks;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'posthog_reader') then
    create role posthog_reader nologin;
  end if;
end $$;

grant usage on schema analytics to posthog_reader;
grant select on all tables in schema analytics to posthog_reader;
