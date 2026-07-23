-- Job posting image (optional poster shown on job cards / admin)
alter table public.jobs_board
  add column if not exists image_url text;
