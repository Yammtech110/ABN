-- Multi-photo gallery for directory listings (up to 5 images in app).
-- Run once in Supabase SQL editor if column is missing.

ALTER TABLE public.profiles_directory
  ADD COLUMN IF NOT EXISTS gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles_directory.gallery_urls IS
  'JSON array of listing photo data URLs or https URLs (logo/cover remain in image_url / cover_url).';
