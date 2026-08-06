-- ============================================================
-- Wipe all app data — KEEP admin user(s) + directory_categories
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- After this, register fresh users/listings. Admin can still sign in.
-- Default admin email used by the app seed: yammtech80@gmail.com
-- (or whatever ADMIN_EMAIL is set on Render)

BEGIN;

-- Child / related tables first
TRUNCATE TABLE IF EXISTS public.jobs_board CASCADE;
TRUNCATE TABLE IF EXISTS public.business_reviews CASCADE;
TRUNCATE TABLE IF EXISTS public.user_favorites CASCADE;
TRUNCATE TABLE IF EXISTS public.listing_reports CASCADE;
TRUNCATE TABLE IF EXISTS public.listing_change_requests CASCADE;
TRUNCATE TABLE IF EXISTS public.membership_payments CASCADE;
TRUNCATE TABLE IF EXISTS public.user_blocks CASCADE;
TRUNCATE TABLE IF EXISTS public.device_tokens CASCADE;
TRUNCATE TABLE IF EXISTS public.app_notifications CASCADE;
TRUNCATE TABLE IF EXISTS public.admin_activity_log CASCADE;
TRUNCATE TABLE IF EXISTS public.profiles_directory CASCADE;

-- Remove every non-admin account
DELETE FROM public.app_users
WHERE role IS DISTINCT FROM 'admin';

-- Optional: if you have more than one admin and only want one email, uncomment:
-- DELETE FROM public.app_users
-- WHERE role = 'admin'
--   AND lower(email) <> lower('yammtech80@gmail.com');

COMMIT;

-- Verify
SELECT email, role, email_verified FROM public.app_users ORDER BY role, email;
SELECT count(*) AS categories FROM public.directory_categories;
SELECT count(*) AS listings FROM public.profiles_directory;
SELECT count(*) AS jobs FROM public.jobs_board;
