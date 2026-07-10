-- ============================================================
-- ABN — extra persistence tables + listing_type column
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- listing_type distinguishes business vs service listings (customer-owned)
alter table public.profiles_directory
  add column if not exists listing_type text default 'business'
    check (listing_type in ('business', 'service'));

-- Ensure updated_at trigger helper exists (from 001, repeated here for safety)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auth accounts persisted across server restarts
create table if not exists public.app_users (
  id                  text primary key,
  email               text unique not null,
  phone               text default '',
  name                text not null,
  role                text not null default 'customer'
                        check (role in ('customer', 'business', 'service_provider', 'admin')),
  password_hash       text not null,
  preferred_language  text default 'en',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;

-- Star ratings persisted per user + listing
create table if not exists public.business_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  business_id   uuid not null references public.profiles_directory(id) on delete cascade,
  rating_score  integer not null check (rating_score between 1 and 5),
  comment       text default '',
  user_name     text,
  review_date   date default current_date,
  created_at    timestamptz default now(),
  unique (user_id, business_id)
);

create index if not exists idx_business_reviews_business
  on public.business_reviews (business_id, created_at desc);

alter table public.business_reviews enable row level security;
