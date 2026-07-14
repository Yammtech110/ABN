-- ============================================================
-- ABN — per-user saved favorites (synced across devices)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.user_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  business_id uuid not null references public.profiles_directory(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, business_id)
);

create index if not exists idx_user_favorites_user
  on public.user_favorites (user_id, created_at desc);

alter table public.user_favorites enable row level security;
