-- ============================================================
-- ABN — membership payment records (server-persisted)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.membership_payments (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.profiles_directory(id) on delete cascade,
  owner_email   text not null,
  amount        numeric(8,2) not null,
  status        text not null default 'success'
                  check (status in ('success', 'failed', 'pending')),
  ref_no        text not null,
  paid_at       date not null default current_date,
  created_at    timestamptz default now()
);

create index if not exists idx_membership_payments_business
  on public.membership_payments (business_id, paid_at desc);

create index if not exists idx_membership_payments_owner
  on public.membership_payments (owner_email, paid_at desc);

alter table public.membership_payments enable row level security;
