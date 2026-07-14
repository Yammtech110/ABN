-- Admin-managed directory categories
create table if not exists public.directory_categories (
  id         text primary key,
  name_en    text not null,
  name_ar    text not null default '',
  cat_group  text not null check (cat_group in ('Shops', 'Services', 'Professionals', 'Food')),
  icon_name  text not null default 'Wrench',
  created_at timestamptz default now()
);

alter table public.directory_categories enable row level security;
