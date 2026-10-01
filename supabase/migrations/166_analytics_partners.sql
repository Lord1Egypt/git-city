-- Read-only audience and ad numbers for PostHog's Partners dashboard (see
-- 165). Aggregates and public GitHub fields only: no emails, IP hashes,
-- user agents, logins or payment fields.

-- One row: the audience a partner reaches.
create or replace view analytics.audience as
  select
    count(*) filter (where d.claimed) as claimed_devs,
    count(*) filter (
      where d.email is not null
        and coalesce(p.email_enabled, true)
        and coalesce(p.product_news, true)
        and not exists (
          select 1 from public.notification_suppressions s
          where s.identifier = d.email and s.channel = 'email'
        )
    ) as email_reach,
    count(*) filter (where d.last_active_at > now() - interval '7 days') as active_7d,
    count(*) filter (where d.last_active_at > now() - interval '30 days') as active_30d
  from public.developers d
  left join public.notification_preferences p on p.developer_id = d.id;

-- Claimed devs' public GitHub profile, for the audience mix.
create or replace view analytics.dev_profiles as
  select id as developer_id, primary_language, followers, last_active_at
  from public.developers
  where claimed;

create or replace view analytics.sky_ads as
  select id, brand, active, starts_at, ends_at, created_at
  from public.sky_ads;

create or replace view analytics.sky_ad_events as
  select ad_id, event_type, created_at, country, device
  from public.sky_ad_events;

grant select on all tables in schema analytics to posthog_reader;
