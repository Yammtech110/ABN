-- Optional: block abusive accounts from signing in
alter table public.app_users
  add column if not exists is_blocked boolean not null default false;
