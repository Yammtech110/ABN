-- ============================================================
-- ABN — Verify Supabase setup (run AFTER all migrations)
-- Supabase → SQL Editor → New query → Run
-- ============================================================
-- Expected: every row shows ok = true

select t.table_name,
       exists (
         select 1
         from information_schema.tables x
         where x.table_schema = 'public'
           and x.table_name = t.table_name
       ) as ok
from (
  values
    ('profiles_directory'),
    ('jobs_board'),
    ('app_users'),
    ('business_reviews'),
    ('membership_payments'),
    ('user_favorites'),
    ('listing_reports'),
    ('directory_categories'),
    ('app_notifications'),
    ('user_blocks')
) as t(table_name)
order by t.table_name;

-- Columns that must exist on app_users / profiles
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_users' and column_name = 'is_blocked'
  ) as app_users_is_blocked_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_users' and column_name = 'email_verified'
  ) as app_users_email_verified_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles_directory' and column_name = 'listing_type'
  ) as profiles_listing_type_ok;
