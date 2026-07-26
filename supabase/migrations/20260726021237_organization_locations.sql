-- One LensWise organization represents the company/subscription. Locations
-- live beneath it so pricing, catalog licensing, and team membership can stay
-- shared while fast-changing inventory remains physically location-specific.

create table if not exists public.organization_locations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  contact_email     text check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone     text check (contact_phone is null or char_length(contact_phone) <= 40),
  contact_address   text check (contact_address is null or char_length(contact_address) <= 400),
  is_primary        boolean not null default false,
  is_active         boolean not null default true,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists organization_locations_org_id_id_unique_idx
  on public.organization_locations (organization_id, id);
create index if not exists organization_locations_org_active_idx
  on public.organization_locations (organization_id, is_active, name);
create index if not exists organization_locations_created_by_idx
  on public.organization_locations (created_by)
  where created_by is not null;
create index if not exists organization_locations_updated_by_idx
  on public.organization_locations (updated_by)
  where updated_by is not null;
create unique index if not exists organization_locations_primary_unique_idx
  on public.organization_locations (organization_id)
  where is_primary;
create unique index if not exists organization_locations_active_name_unique_idx
  on public.organization_locations (organization_id, lower(name))
  where is_active;

-- Existing organizations receive a primary location using their current office
-- details. This makes the migration lossless for existing inventory and print
-- settings.
insert into public.organization_locations (
  organization_id,
  name,
  contact_email,
  contact_phone,
  contact_address,
  is_primary,
  created_by,
  updated_by
)
select
  organization.id,
  coalesce(nullif(btrim(settings.office_name), ''), organization.name),
  settings.contact_email,
  settings.contact_phone,
  settings.contact_address,
  true,
  organization.created_by,
  organization.created_by
from public.organizations as organization
left join public.organization_settings as settings
  on settings.organization_id = organization.id
where not exists (
  select 1
  from public.organization_locations as existing_location
  where existing_location.organization_id = organization.id
);

create or replace function public.set_organization_location_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_locations_set_updated_at on public.organization_locations;
create trigger organization_locations_set_updated_at
  before update on public.organization_locations
  for each row execute function public.set_organization_location_updated_at();

-- All current organization-creation paths already run through trusted RPCs or
-- service-role code. This invoker trigger ensures future organizations also
-- start with exactly one usable location.
create or replace function public.create_default_organization_location()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_locations (
    organization_id,
    name,
    is_primary,
    created_by,
    updated_by
  )
  values (
    new.id,
    new.name,
    true,
    new.created_by,
    new.created_by
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_create_default_location on public.organizations;
create trigger organizations_create_default_location
  after insert on public.organizations
  for each row execute function public.create_default_organization_location();

alter table public.organization_locations enable row level security;

drop policy if exists organization_locations_select on public.organization_locations;
create policy organization_locations_select
  on public.organization_locations for select
  to authenticated
  using (
    (public.is_org_member(organization_id) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

drop policy if exists organization_locations_insert on public.organization_locations;
create policy organization_locations_insert
  on public.organization_locations for insert
  to authenticated
  with check (
    (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

drop policy if exists organization_locations_update on public.organization_locations;
create policy organization_locations_update
  on public.organization_locations for update
  to authenticated
  using (
    (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
    or public.is_super_admin()
  )
  with check (
    (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

revoke all on public.organization_locations from anon;
grant select, insert, update on public.organization_locations to authenticated;
revoke all on function public.set_organization_location_updated_at() from public;
revoke all on function public.create_default_organization_location() from public;

-- Scope inventory to a physical location. The composite foreign key prevents a
-- location from a different company being attached to an inventory row even if
-- a malformed server request supplies both IDs.
alter table public.frame_inventory
  add column if not exists location_id uuid;

update public.frame_inventory as inventory
set location_id = (
  select location.id
  from public.organization_locations as location
  where location.organization_id = inventory.organization_id
  order by location.is_primary desc, location.created_at, location.id
  limit 1
)
where inventory.location_id is null;

alter table public.frame_inventory
  alter column location_id set not null;

-- Deployment compatibility: an older frontend may briefly be live after this
-- migration and still insert organization-scoped inventory without a
-- location_id. Assign those writes to the primary location until all app
-- instances are on the location-aware code.
create or replace function public.assign_default_frame_inventory_location()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.location_id is null then
    select location.id
      into new.location_id
    from public.organization_locations as location
    where location.organization_id = new.organization_id
      and location.is_active
    order by location.is_primary desc, location.created_at, location.id
    limit 1;
  end if;

  if new.location_id is null then
    raise exception 'An active organization location is required.';
  end if;

  return new;
end;
$$;

drop trigger if exists frame_inventory_assign_default_location on public.frame_inventory;
create trigger frame_inventory_assign_default_location
  before insert on public.frame_inventory
  for each row execute function public.assign_default_frame_inventory_location();

revoke all on function public.assign_default_frame_inventory_location() from public;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'frame_inventory_organization_location_fkey'
      and conrelid = 'public.frame_inventory'::regclass
  ) then
    alter table public.frame_inventory
      add constraint frame_inventory_organization_location_fkey
      foreign key (organization_id, location_id)
      references public.organization_locations (organization_id, id)
      on update cascade
      on delete restrict;
  end if;
end;
$$;

drop index if exists public.frame_inventory_org_active_idx;
drop index if exists public.frame_inventory_org_stock_idx;
drop index if exists public.frame_inventory_org_sku_unique_idx;
drop index if exists public.frame_inventory_org_catalog_item_unique_idx;

create index if not exists frame_inventory_location_active_idx
  on public.frame_inventory (location_id, is_active, brand, model);
create index if not exists frame_inventory_location_stock_idx
  on public.frame_inventory (location_id, quantity_on_hand);
create index if not exists frame_inventory_org_location_idx
  on public.frame_inventory (organization_id, location_id);
create unique index if not exists frame_inventory_location_sku_unique_idx
  on public.frame_inventory (location_id, lower(sku))
  where sku is not null and btrim(sku) <> '';
create unique index if not exists frame_inventory_location_catalog_item_unique_idx
  on public.frame_inventory (location_id, catalog_source, catalog_item_id)
  where catalog_item_id is not null and btrim(catalog_item_id) <> '';

create or replace function public.audit_organization_location_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  location_row public.organization_locations;
  audit_action text;
begin
  if tg_op = 'INSERT' then
    location_row := new;
    audit_action := 'location.create';
  elsif tg_op = 'DELETE' then
    location_row := old;
    audit_action := 'location.delete';
  else
    location_row := new;
    audit_action := case
      when new.is_active is distinct from old.is_active and not new.is_active then 'location.archive'
      when new.is_active is distinct from old.is_active and new.is_active then 'location.restore'
      else 'location.update'
    end;
  end if;

  perform public.write_audit(
    location_row.organization_id,
    auth.uid(),
    audit_action,
    'organization_location',
    location_row.id::text,
    jsonb_build_object('name', location_row.name)
  );
  return location_row;
end;
$$;

drop trigger if exists organization_locations_audit on public.organization_locations;
create trigger organization_locations_audit
  after insert or update or delete on public.organization_locations
  for each row execute function public.audit_organization_location_change();

revoke all on function public.audit_organization_location_change() from public;

create or replace function public.audit_frame_inventory_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row public.frame_inventory;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_action := 'inventory.frame_create';
  elsif tg_op = 'DELETE' then
    v_row := old;
    v_action := 'inventory.frame_delete';
  else
    v_row := new;
    v_action := case
      when new.is_active is distinct from old.is_active and not new.is_active then 'inventory.frame_archive'
      when new.is_active is distinct from old.is_active and new.is_active then 'inventory.frame_restore'
      else 'inventory.frame_update'
    end;
  end if;

  perform public.write_audit(
    v_row.organization_id,
    auth.uid(),
    v_action,
    'frame_inventory',
    v_row.id::text,
    jsonb_build_object(
      'brand', v_row.brand,
      'model', v_row.model,
      'location_id', v_row.location_id
    )
  );
  return v_row;
end;
$$;

revoke all on function public.audit_frame_inventory_change() from public;
