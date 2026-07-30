-- Licensed frame photos remain disabled unless the platform Super Admin
-- explicitly enables them for an organization.
alter table public.organization_settings
  add column if not exists frame_photos_enabled boolean not null default false;

comment on column public.organization_settings.frame_photos_enabled is
  'Platform-managed permission for authenticated organization screens to render licensed frame catalog photos.';

-- organization_settings is normally editable by organization owners/admins.
-- Protect this one licensing-sensitive column independently so UI hiding is
-- never the authorization boundary. The service role remains allowed for
-- trusted server maintenance.
create or replace function public.prevent_org_frame_photo_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.frame_photos_enabled
      and coalesce(auth.role(), '') <> 'service_role'
      and not public.is_super_admin() then
      raise exception 'Only a platform super admin can change frame photo visibility';
    end if;
    return old;
  elsif tg_op = 'INSERT' then
    if new.frame_photos_enabled
      and coalesce(auth.role(), '') <> 'service_role'
      and not public.is_super_admin() then
      raise exception 'Only a platform super admin can change frame photo visibility';
    end if;
  elsif new.frame_photos_enabled is distinct from old.frame_photos_enabled
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_super_admin() then
      raise exception 'Only a platform super admin can change frame photo visibility';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_settings_guard_frame_photos
  on public.organization_settings;
create trigger organization_settings_guard_frame_photos
  before insert or update or delete on public.organization_settings
  for each row execute function public.prevent_org_frame_photo_visibility_change();
