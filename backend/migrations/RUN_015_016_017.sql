-- Run in Supabase SQL Editor (one shot for features shipped 2026-07)
-- Review replies, admin activity log, listing state

alter table public.business_reviews
  add column if not exists owner_reply text default '',
  add column if not exists owner_reply_at timestamptz,
  add column if not exists owner_reply_by text default '';

create table if not exists public.admin_activity_log (
  id             uuid primary key default gen_random_uuid(),
  admin_id       text not null default '',
  admin_email    text not null default '',
  admin_name     text not null default '',
  action         text not null,
  target_type    text not null default 'listing'
                   check (target_type in ('listing', 'user', 'job', 'change_request', 'payment', 'other')),
  target_id      text not null default '',
  target_name    text not null default '',
  details        text not null default '',
  created_at     timestamptz default now()
);

create index if not exists idx_admin_activity_log_created
  on public.admin_activity_log (created_at desc);

create index if not exists idx_admin_activity_log_action
  on public.admin_activity_log (action, created_at desc);

alter table public.admin_activity_log enable row level security;

alter table public.profiles_directory
  add column if not exists state text default '';
