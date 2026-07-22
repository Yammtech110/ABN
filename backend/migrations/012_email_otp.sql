-- Persist email OTP so verification survives Render restarts / multi-instance.
alter table public.app_users
  add column if not exists email_otp text,
  add column if not exists email_otp_expires timestamptz;
