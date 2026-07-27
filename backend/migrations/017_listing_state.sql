-- Persist US state on directory listings (sent at registration)
alter table public.profiles_directory
  add column if not exists state text default '';
