-- Owner reply on customer reviews
alter table public.business_reviews
  add column if not exists owner_reply text default '',
  add column if not exists owner_reply_at timestamptz,
  add column if not exists owner_reply_by text default '';
