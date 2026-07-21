-- 010_compliance.sql — email verification + peer block list
alter table if exists public.app_users
  add column if not exists email_verified boolean not null default true;

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id text not null,
  blocked_user_id text not null,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
