-- Device tokens for FCM / APNs push notifications
create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  user_role   text not null default 'customer'
                check (user_role in ('customer', 'business', 'service_provider', 'admin')),
  token       text not null,
  platform    text not null default 'android'
                check (platform in ('android', 'ios', 'web')),
  updated_at  timestamptz default now(),
  unique (token)
);

create index if not exists idx_device_tokens_user
  on public.device_tokens (user_id);

create index if not exists idx_device_tokens_role
  on public.device_tokens (user_role);

alter table public.device_tokens enable row level security;
