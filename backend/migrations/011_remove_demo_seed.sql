-- Remove demo/seed listings & jobs from production (Al-Kawthar, Noor Electricians).
-- Run in Supabase → SQL Editor if needed again.

delete from public.jobs_board
where id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004'
);

delete from public.profiles_directory
where id in (
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002'
)
or email in (
  'business@shiadirectory.com',
  'service@shiadirectory.com'
);

-- Optional: remove demo auth accounts (does NOT delete real users)
delete from public.app_users
where email in (
  'business@shiadirectory.com',
  'service@shiadirectory.com',
  'customer@shiadirectory.com'
);
