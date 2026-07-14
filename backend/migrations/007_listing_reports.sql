-- Community integrity reports — flagged listings submitted by signed-in users
create table if not exists public.listing_reports (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.profiles_directory(id) on delete cascade,
  business_name  text not null default '',
  reporter_id    text not null,
  reporter_name  text not null default '',
  reporter_email text not null default '',
  reason         text not null,
  status         text not null default 'open'
                   check (status in ('open', 'resolved')),
  admin_notes    text default '',
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);

create index if not exists idx_listing_reports_status
  on public.listing_reports (status, created_at desc);

alter table public.listing_reports enable row level security;
