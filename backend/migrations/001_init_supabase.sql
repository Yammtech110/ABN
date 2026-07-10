-- ============================================================
-- ABN Community Directory — Supabase SQL Migration
-- Run this entire script in:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ── 0. Extensions ────────────────────────────────────────────────────────
-- gen_random_uuid() is available by default in Supabase (pg 14+)
-- pgcrypto gives us crypt() for password hashing if ever needed
create extension if not exists "pgcrypto";


-- ── 1. profiles_directory ────────────────────────────────────────────────
-- Stores every registered business / service provider profile.
-- Customers are NOT stored here; they belong in Supabase Auth or your own
-- users table. Only business_owner and service_provider rows live here.

create table if not exists public.profiles_directory (
  id                  uuid primary key default gen_random_uuid(),

  -- Auth / identity
  email               text unique not null,
  role                text not null
                        check (role in ('business_owner', 'service_provider', 'customer')),

  -- Business meta
  business_name       text,
  category            text,                       -- e.g. 'Grocery Store', 'Electrician'
  subscription_status text default 'active'
                        check (subscription_status in ('active', 'suspended', 'pending')),
  subscription_tier   numeric(6,2) default 0,     -- 50.00 or 30.00

  -- Public listing fields
  image_url           text,                        -- Business card image / logo
  cover_url           text,
  description         text,
  address             text,
  area                text,
  city                text,
  phone               text,
  whatsapp            text,
  website             text,
  working_hours       text,

  -- Hiring toggle (synced with jobs_board.is_active)
  hiring_active       boolean default false,

  -- Directory metadata
  is_verified         boolean default false,
  is_active           boolean default true,
  rating              numeric(3,1) default 0,
  reviews_count       integer default 0,
  membership_expiry   date,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_directory_updated_at
  before update on public.profiles_directory
  for each row execute function public.set_updated_at();


-- ── 2. jobs_board ────────────────────────────────────────────────────────
-- Stores all job postings linked to a business profile.
-- Cascade-deletes when the parent profile is removed.

create table if not exists public.jobs_board (
  id            uuid primary key default gen_random_uuid(),

  business_id   uuid not null
                  references public.profiles_directory(id)
                  on delete cascade,

  -- Denormalised for fast read (avoids a join on every list view)
  business_name       text not null,
  business_logo_url   text,

  -- Job details
  title         text not null,
  category      text not null
                  check (category in (
                    'IT', 'Graphic Designing', 'Developer',
                    'Chef', 'Maid', 'Others'
                  )),
  requirements  text,
  salary_min    numeric(10,2) not null check (salary_min >= 0),
  salary_max    numeric(10,2) not null check (salary_max >= salary_min),
  hiring_email  text not null,

  is_active     boolean default true,
  posted_date   date default current_date,
  created_at    timestamptz default now()
);

-- Index: fast lookup of active jobs per business
create index if not exists idx_jobs_board_business_active
  on public.jobs_board (business_id, is_active);

-- Index: fast public feed (all active jobs, newest first)
create index if not exists idx_jobs_board_active_created
  on public.jobs_board (is_active, created_at desc);


-- ── 3. Row Level Security ────────────────────────────────────────────────
-- We use our own JWT auth (not Supabase Auth), so:
--   • anon key  → read-only public access
--   • service_role key → full access from the backend (bypasses RLS)

alter table public.profiles_directory enable row level security;
alter table public.jobs_board         enable row level security;

-- profiles_directory: anyone can read active listings
create policy "Public can read active profiles"
  on public.profiles_directory
  for select
  using (is_active = true);

-- jobs_board: anyone can read active jobs
create policy "Public can read active jobs"
  on public.jobs_board
  for select
  using (is_active = true);

-- All writes go through the backend using the service_role key,
-- which bypasses RLS automatically — no additional write policies needed.


-- ── 4. Seed: Demo Profiles ───────────────────────────────────────────────
-- Fixed UUIDs so the jobs_board FK references work predictably.
-- Use ON CONFLICT DO NOTHING so re-running the script is safe.

insert into public.profiles_directory (
  id, email, role,
  business_name, category,
  subscription_status, subscription_tier,
  image_url, cover_url, description,
  address, area, city,
  phone, whatsapp, website, working_hours,
  hiring_active, is_verified, is_active,
  rating, reviews_count, membership_expiry
)
values
  -- ── Business Owner: Al-Kawthar Grocery ($50 tier) ──
  (
    'c0000000-0000-0000-0000-000000000001',
    'business@shiadirectory.com',
    'business_owner',
    'Al-Kawthar Grocery',
    'Grocery Store',
    'active', 50.00,
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200',
    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=1200&h=400',
    'Premium organic grocery store providing fresh halal products, fruits, vegetables, and high-quality Middle Eastern spices and staples to the community.',
    'Karada St, Near Al-Attar Mosque', 'Karada', 'New York',
    '+1 770 123 4567', '+17701234567', 'https://alkawtharmarket.com',
    '8:00 AM – 11:00 PM',
    true, true, true,
    4.8, 15, '2026-10-15'
  ),

  -- ── Service Provider: Noor Electricians ($30 tier) ──
  (
    'c0000000-0000-0000-0000-000000000002',
    'service@shiadirectory.com',
    'service_provider',
    'Noor Electricians',
    'Electrician',
    'active', 30.00,
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200&h=200',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=1200&h=400',
    'Certified local electrical installation, power cabling, backup generator setups, and emergency repair services for houses and shops.',
    'Palestine St, Intersection 4', 'Palestine Street', 'New York',
    '+1 780 987 6543', '+17809876543', '',
    '9:00 AM – 9:00 PM (24/7 for emergencies)',
    true, true, true,
    4.9, 8, '2026-10-15'
  )
on conflict (id) do nothing;


-- ── 5. Seed: Demo Jobs ────────────────────────────────────────────────────

insert into public.jobs_board (
  id, business_id, business_name, business_logo_url,
  title, category, requirements,
  salary_min, salary_max, hiring_email,
  is_active, posted_date
)
values
  -- Al-Kawthar: Deli Chef
  (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Al-Kawthar Grocery',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200',
    'Deli Chef', 'Chef',
    'Experienced in Middle Eastern cuisine. Ability to work in a fast-paced environment. Food safety certification preferred. Minimum 2 years kitchen experience.',
    2000, 3200, 'jobs@alkawtharmarket.com',
    true, '2026-07-01'
  ),

  -- Al-Kawthar: Store Inventory Manager
  (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'Al-Kawthar Grocery',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200',
    'Store Inventory Manager', 'Others',
    'Minimum 2 years retail management experience. Strong organizational skills. Bilingual (English/Arabic) a strong plus. Must be familiar with POS systems.',
    2500, 3500, 'jobs@alkawtharmarket.com',
    true, '2026-07-02'
  ),

  -- Noor Electricians: Senior Electrician
  (
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000002',
    'Noor Electricians',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200&h=200',
    'Senior Electrician', 'IT',
    'Licensed certified electrician. 5+ years of commercial and residential wiring experience. Must have valid driving license. Physically fit for on-site work.',
    3000, 5000, 'service@shiadirectory.com',
    true, '2026-07-04'
  ),

  -- Noor Electricians: Office Admin & Designer
  (
    'd0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000002',
    'Noor Electricians',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200&h=200',
    'Office Admin & Designer', 'Graphic Designing',
    'Proficient in Adobe Suite (Illustrator, Photoshop). Experience creating social media content and print collateral. Strong organizational abilities.',
    1800, 2800, 'service@shiadirectory.com',
    true, '2026-07-05'
  )
on conflict (id) do nothing;


-- ── Done ─────────────────────────────────────────────────────────────────
-- Verify with:
--   select * from profiles_directory;
--   select * from jobs_board;
