-- In-app notifications for users and role-based broadcasts
create table if not exists public.app_notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        text,
  receiver_role  text not null default 'all'
                   check (receiver_role in ('customer', 'business', 'service_provider', 'admin', 'all')),
  title          text not null,
  message        text not null,
  is_read        boolean not null default false,
  created_at     timestamptz default now()
);

create index if not exists idx_app_notifications_role
  on public.app_notifications (receiver_role, created_at desc);

alter table public.app_notifications enable row level security;
