-- Per-account theme preference (light / dark / system).
alter table public.profiles
  add column if not exists theme_preference text not null default 'system'
  check (theme_preference in ('light', 'dark', 'system'));

-- The existing profiles_update_self policy already lets a user update their own
-- profile row; the super-admin guard trigger only blocks is_super_admin, so a
-- user can freely change their own theme_preference.
