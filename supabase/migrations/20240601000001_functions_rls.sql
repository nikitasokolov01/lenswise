-- LensWise multi-tenant SaaS — functions, RLS policies, audit, and RPCs.
-- Runs after 20240601000000_init_schema.sql.

-- ===========================================================================
-- 1. New-user provisioning: create a profile row for every auth user.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- 2. Tenancy helper functions (SECURITY DEFINER so RLS policies that reference
--    membership do not recurse). All are STABLE and read-only.
-- ===========================================================================
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.role = any(p_roles)
  );
$$;

create or replace function public.org_is_active(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = p_org and o.status = 'active');
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.is_org_member(uuid) to anon, authenticated;
grant execute on function public.has_org_role(uuid, text[]) to anon, authenticated;
grant execute on function public.org_is_active(uuid) to anon, authenticated;
grant execute on function public.shares_org_with(uuid) to anon, authenticated;

-- ===========================================================================
-- 3. Guard triggers.
-- ===========================================================================
-- Super Admin can ONLY be granted by the service role (server-side). No UI or
-- authenticated user can promote themselves.
create or replace function public.prevent_super_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_super_admin can only be changed by the service role';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_super_admin on public.profiles;
create trigger profiles_guard_super_admin before update on public.profiles
  for each row execute function public.prevent_super_admin_change();

-- Organization status (active/disabled) can only be changed by a Super Admin
-- (or the service role). Owners/Admins may edit other org fields.
create or replace function public.prevent_org_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_super_admin() then
    raise exception 'Only a super admin can change organization status';
  end if;
  return new;
end;
$$;
drop trigger if exists organizations_guard_status on public.organizations;
create trigger organizations_guard_status before update on public.organizations
  for each row execute function public.prevent_org_status_change();

-- Never allow removing/demoting the last Owner of an organization.
create or replace function public.protect_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner_count integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*) into v_owner_count from public.organization_members
        where organization_id = old.organization_id and role = 'owner';
      if v_owner_count <= 1 then
        raise exception 'Cannot remove the last owner. Transfer ownership first.';
      end if;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into v_owner_count from public.organization_members
        where organization_id = old.organization_id and role = 'owner';
      if v_owner_count <= 1 then
        raise exception 'Cannot demote the last owner. Transfer ownership first.';
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;
drop trigger if exists members_protect_last_owner on public.organization_members;
create trigger members_protect_last_owner before update or delete on public.organization_members
  for each row execute function public.protect_last_owner();

-- ===========================================================================
-- 4. Audit logging. write_audit is the ONLY writer of audit_log (SECURITY
--    DEFINER); clients have no INSERT policy. Never records secrets/tokens.
-- ===========================================================================
create or replace function public.write_audit(
  p_org uuid, p_actor uuid, p_action text, p_target_type text, p_target_id text, p_metadata jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (p_org, p_actor, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.audit_pricing_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(new.organization_id, auth.uid(), 'pricing.update',
    'pricing_configuration', new.organization_id::text,
    jsonb_build_object('schema_version', new.schema_version));
  return new;
end;
$$;
drop trigger if exists pricing_audit on public.pricing_configurations;
create trigger pricing_audit after insert or update on public.pricing_configurations
  for each row execute function public.audit_pricing_change();

create or replace function public.audit_member_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.organization_id, auth.uid(), 'member.add',
      'organization_member', new.user_id::text, jsonb_build_object('role', new.role));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform public.write_audit(new.organization_id, auth.uid(), 'member.role_change',
        'organization_member', new.user_id::text, jsonb_build_object('from', old.role, 'to', new.role));
    end if;
    return new;
  else
    perform public.write_audit(old.organization_id, auth.uid(), 'member.remove',
      'organization_member', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
end;
$$;
drop trigger if exists member_audit on public.organization_members;
create trigger member_audit after insert or update or delete on public.organization_members
  for each row execute function public.audit_member_change();

create or replace function public.audit_regkey_create()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(null, auth.uid(), 'regkey.create',
    'registration_key', new.id::text,
    jsonb_build_object('label', new.label, 'max_uses', new.max_uses, 'expires_at', new.expires_at));
  return new;
end;
$$;
drop trigger if exists regkey_audit on public.registration_keys;
create trigger regkey_audit after insert on public.registration_keys
  for each row execute function public.audit_regkey_create();

create or replace function public.audit_org_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.id, auth.uid(), 'org.create', 'organization', new.id::text,
      jsonb_build_object('name', new.name));
    return new;
  else
    if new.status is distinct from old.status then
      perform public.write_audit(new.id, auth.uid(),
        case when new.status = 'disabled' then 'org.disable' else 'org.enable' end,
        'organization', new.id::text, jsonb_build_object('status', new.status));
    end if;
    return new;
  end if;
end;
$$;
drop trigger if exists org_audit on public.organizations;
create trigger org_audit after insert or update on public.organizations
  for each row execute function public.audit_org_change();

create or replace function public.audit_invitation_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.organization_id, auth.uid(), 'invitation.create',
      'invitation', new.id::text, jsonb_build_object('email', new.email, 'role', new.role));
    return new;
  elsif tg_op = 'UPDATE' and new.status = 'revoked' and old.status is distinct from 'revoked' then
    perform public.write_audit(new.organization_id, auth.uid(), 'invitation.revoke',
      'invitation', new.id::text, jsonb_build_object('email', new.email));
  end if;
  return new;
end;
$$;
drop trigger if exists invitation_audit on public.invitations;
create trigger invitation_audit after insert or update on public.invitations
  for each row execute function public.audit_invitation_change();

create or replace function public.audit_regkey_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.revoked and not old.revoked then
    perform public.write_audit(null, auth.uid(), 'regkey.revoke', 'registration_key', new.id::text,
      jsonb_build_object('label', new.label));
  end if;
  return new;
end;
$$;
drop trigger if exists regkey_update_audit on public.registration_keys;
create trigger regkey_update_audit after update on public.registration_keys
  for each row execute function public.audit_regkey_update();

create or replace function public.audit_org_settings_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(new.organization_id, auth.uid(), 'org.settings_update',
    'organization_settings', new.organization_id::text, '{}'::jsonb);
  return new;
end;
$$;
drop trigger if exists org_settings_audit on public.organization_settings;
create trigger org_settings_audit after insert or update on public.organization_settings
  for each row execute function public.audit_org_settings_change();

-- ===========================================================================
-- 5. Enable Row Level Security on every tenant table.
-- ===========================================================================
alter table public.profiles                     enable row level security;
alter table public.organizations                enable row level security;
alter table public.organization_settings        enable row level security;
alter table public.organization_members         enable row level security;
alter table public.registration_keys            enable row level security;
alter table public.registration_key_redemptions enable row level security;
alter table public.invitations                  enable row level security;
alter table public.pricing_configurations       enable row level security;
alter table public.audit_log                    enable row level security;

-- ===========================================================================
-- 6. Policies.
-- ===========================================================================
-- profiles: self, super admin, or co-members (for the Team page names/emails).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin() or public.shares_org_with(id));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members read their own; super admin reads all. Owners/Admins
-- may update org fields (status change is blocked to super admin by trigger).
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or public.is_super_admin());
drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['owner','admin']) or public.is_super_admin())
  with check (public.has_org_role(id, array['owner','admin']) or public.is_super_admin());

-- organization_settings: members read; owners/admins write.
drop policy if exists org_settings_select on public.organization_settings;
create policy org_settings_select on public.organization_settings for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());
drop policy if exists org_settings_write on public.organization_settings;
create policy org_settings_write on public.organization_settings for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin());

-- organization_members: members read; owners/admins manage. Only owners may
-- create/keep an 'owner' role; the last-owner trigger blocks removal/demotion.
drop policy if exists members_select on public.organization_members;
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());
drop policy if exists members_insert on public.organization_members;
create policy members_insert on public.organization_members for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.has_org_role(organization_id, array['owner','admin']) and role in ('admin','staff'))
    or (public.has_org_role(organization_id, array['owner']) and role = 'owner')
  );
drop policy if exists members_update on public.organization_members;
create policy members_update on public.organization_members for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin())
  with check (
    public.is_super_admin()
    or (public.has_org_role(organization_id, array['owner','admin']) and role in ('admin','staff'))
    or (public.has_org_role(organization_id, array['owner']) and role = 'owner')
  );
drop policy if exists members_delete on public.organization_members;
create policy members_delete on public.organization_members for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin());

-- registration_keys / redemptions: Super Admin only.
drop policy if exists regkeys_super_admin on public.registration_keys;
create policy regkeys_super_admin on public.registration_keys for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists regkey_redemptions_select on public.registration_key_redemptions;
create policy regkey_redemptions_select on public.registration_key_redemptions for select to authenticated
  using (public.is_super_admin());

-- invitations: managed by owners/admins of the org (and super admin).
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin());
drop policy if exists invitations_write on public.invitations;
create policy invitations_write on public.invitations for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) or public.is_super_admin())
  with check (
    (public.has_org_role(organization_id, array['owner','admin']) and role in ('admin','staff'))
    or public.is_super_admin()
  );

-- pricing_configurations: every member of an ACTIVE org reads it; owners/admins
-- of an active org write it. Disabled orgs are blocked (defense in depth).
drop policy if exists pricing_select on public.pricing_configurations;
create policy pricing_select on public.pricing_configurations for select to authenticated
  using ((public.is_org_member(organization_id) and public.org_is_active(organization_id)) or public.is_super_admin());
drop policy if exists pricing_write on public.pricing_configurations;
create policy pricing_write on public.pricing_configurations for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
  with check (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id));

-- audit_log: super admin reads all; org owners/admins read their org's log.
-- No client INSERT policy — only write_audit (SECURITY DEFINER) writes.
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']))
  );

-- ===========================================================================
-- 7. Atomic registration: validate a registration key and create the org,
--    settings, owner membership, and default pricing — all in one transaction.
--    Callable by the newly-signed-in user (auth.uid() = p_user_id) or by the
--    service role (server action passing the new user's id for full rollback).
-- ===========================================================================
create or replace function public.redeem_key_and_create_org(
  p_user_id uuid, p_key text, p_org_name text, p_default_pricing jsonb, p_schema_version integer
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash   text;
  v_key    public.registration_keys%rowtype;
  v_org_id uuid;
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;
  if coalesce(btrim(p_org_name), '') = '' then raise exception 'office name required'; end if;

  v_hash := encode(digest(p_key, 'sha256'), 'hex');

  select * into v_key from public.registration_keys where key_hash = v_hash for update;
  if not found then raise exception 'invalid_registration_key'; end if;
  if v_key.revoked then raise exception 'registration_key_revoked'; end if;
  if v_key.expires_at is not null and v_key.expires_at < now() then raise exception 'registration_key_expired'; end if;
  if v_key.uses >= v_key.max_uses then raise exception 'registration_key_used_up'; end if;

  insert into public.organizations (name, created_by) values (btrim(p_org_name), p_user_id) returning id into v_org_id;
  insert into public.organization_settings (organization_id, office_name) values (v_org_id, btrim(p_org_name));
  insert into public.organization_members (organization_id, user_id, role) values (v_org_id, p_user_id, 'owner');
  insert into public.pricing_configurations (organization_id, config, schema_version, updated_by)
    values (v_org_id, p_default_pricing, p_schema_version, p_user_id);

  update public.registration_keys set uses = uses + 1 where id = v_key.id;
  insert into public.registration_key_redemptions (key_id, organization_id, redeemed_by)
    values (v_key.id, v_org_id, p_user_id);

  perform public.write_audit(v_org_id, p_user_id, 'regkey.redeem', 'registration_key', v_key.id::text,
    jsonb_build_object('label', v_key.label));

  return v_org_id;
end;
$$;
revoke all on function public.redeem_key_and_create_org(uuid, text, text, jsonb, integer) from public;
grant execute on function public.redeem_key_and_create_org(uuid, text, text, jsonb, integer) to authenticated, service_role;

-- Accept an invitation by its plaintext token (email must match the caller).
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_inv public.invitations%rowtype;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select * into v_inv from public.invitations where token_hash = v_hash for update;
  if not found then raise exception 'invalid_invitation'; end if;
  if v_inv.status <> 'pending' then raise exception 'invitation_not_pending'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then raise exception 'invitation_expired'; end if;
  if lower(v_inv.email) <> lower((select u.email from auth.users u where u.id = auth.uid())) then
    raise exception 'invitation_email_mismatch';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
    values (v_inv.organization_id, auth.uid(), v_inv.role)
    on conflict (organization_id, user_id) do update set role = excluded.role;
  update public.invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where id = v_inv.id;
  perform public.write_audit(v_inv.organization_id, auth.uid(), 'invitation.accept',
    'invitation', v_inv.id::text, jsonb_build_object('role', v_inv.role));
  return v_inv.organization_id;
end;
$$;
grant execute on function public.accept_invitation(text) to authenticated;

-- Bootstrap the platform Super Admin from a trusted server (service role only).
-- Invoked by the app using SUPABASE_SERVICE_ROLE_KEY + SUPER_ADMIN_EMAIL.
create or replace function public.promote_super_admin(p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only the service role may promote a super admin';
  end if;
  update public.profiles p set is_super_admin = true, updated_at = now()
    from auth.users u
   where u.id = p.id and lower(u.email) = lower(p_email);
end;
$$;
revoke all on function public.promote_super_admin(text) from public;
grant execute on function public.promote_super_admin(text) to service_role;

-- ===========================================================================
-- 8. Base privileges (RLS still governs row visibility). Authenticated users
--    get table DML; anon gets nothing. Service role bypasses RLS entirely.
-- ===========================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
