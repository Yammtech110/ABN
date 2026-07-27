-- Pending name / logo / cover changes requested by listing owners (admin must approve)
create table if not exists public.listing_change_requests (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.profiles_directory(id) on delete cascade,
  owner_email          text not null default '',
  current_name         text not null default '',
  proposed_name        text,
  proposed_image_url   text,
  proposed_cover_url   text,
  note                 text not null default '',
  status               text not null default 'pending'
                         check (status in ('pending', 'approved', 'rejected')),
  admin_notes          text default '',
  created_at           timestamptz default now(),
  resolved_at          timestamptz
);

create index if not exists idx_listing_change_requests_status
  on public.listing_change_requests (status, created_at desc);

create index if not exists idx_listing_change_requests_business
  on public.listing_change_requests (business_id, status);

alter table public.listing_change_requests enable row level security;
