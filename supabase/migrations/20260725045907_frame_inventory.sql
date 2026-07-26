-- Organization-scoped frame inventory. This is intentionally separate from
-- pricing_configurations JSONB: frame stock changes frequently and should not
-- trigger pricing-schema migrations or risk the quote engine's configuration.

create table if not exists public.frame_inventory (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  brand                 text not null check (char_length(btrim(brand)) between 1 and 80),
  model                 text not null check (char_length(btrim(model)) between 1 and 100),
  color                 text not null default '' check (char_length(color) <= 80),
  eye_size_mm            smallint check (eye_size_mm between 20 and 80),
  bridge_size_mm         smallint check (bridge_size_mm between 5 and 40),
  temple_length_mm       smallint check (temple_length_mm between 80 and 180),
  sku                   text check (sku is null or char_length(sku) <= 80),
  upc                   text check (upc is null or char_length(upc) <= 32),
  wholesale_cost_cents   integer not null default 0 check (wholesale_cost_cents >= 0),
  retail_price_cents     integer not null default 0 check (retail_price_cents >= 0),
  quantity_on_hand       integer not null default 0 check (quantity_on_hand between 0 and 99999),
  reorder_level          integer not null default 1 check (reorder_level between 0 and 99999),
  notes                 text not null default '' check (char_length(notes) <= 1000),
  is_active             boolean not null default true,
  image_url             text,
  catalog_source        text not null default 'manual' check (char_length(catalog_source) between 1 and 50),
  catalog_item_id       text,
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists frame_inventory_org_active_idx
  on public.frame_inventory (organization_id, is_active, brand, model);
create index if not exists frame_inventory_org_stock_idx
  on public.frame_inventory (organization_id, quantity_on_hand);
create unique index if not exists frame_inventory_org_sku_unique_idx
  on public.frame_inventory (organization_id, lower(sku))
  where sku is not null and btrim(sku) <> '';
create unique index if not exists frame_inventory_org_catalog_item_unique_idx
  on public.frame_inventory (organization_id, catalog_source, catalog_item_id)
  where catalog_item_id is not null and btrim(catalog_item_id) <> '';

create or replace function public.set_frame_inventory_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists frame_inventory_set_updated_at on public.frame_inventory;
create trigger frame_inventory_set_updated_at
  before update on public.frame_inventory
  for each row execute function public.set_frame_inventory_updated_at();

create or replace function public.audit_frame_inventory_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_row public.frame_inventory;
  v_action text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  v_action := case
    when tg_op = 'INSERT' then 'inventory.frame_create'
    when tg_op = 'DELETE' then 'inventory.frame_delete'
    when new.is_active is distinct from old.is_active and not new.is_active then 'inventory.frame_archive'
    when new.is_active is distinct from old.is_active and new.is_active then 'inventory.frame_restore'
    else 'inventory.frame_update'
  end;

  perform public.write_audit(
    v_row.organization_id,
    auth.uid(),
    v_action,
    'frame_inventory',
    v_row.id::text,
    jsonb_build_object('brand', v_row.brand, 'model', v_row.model)
  );
  return v_row;
end;
$$;

drop trigger if exists frame_inventory_audit on public.frame_inventory;
create trigger frame_inventory_audit
  after insert or update or delete on public.frame_inventory
  for each row execute function public.audit_frame_inventory_change();

alter table public.frame_inventory enable row level security;

drop policy if exists frame_inventory_select on public.frame_inventory;
create policy frame_inventory_select
  on public.frame_inventory for select
  to authenticated
  using (
    (public.is_org_member(organization_id) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

drop policy if exists frame_inventory_insert on public.frame_inventory;
create policy frame_inventory_insert
  on public.frame_inventory for insert
  to authenticated
  with check (
    (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

drop policy if exists frame_inventory_update on public.frame_inventory;
create policy frame_inventory_update
  on public.frame_inventory for update
  to authenticated
  using (
    (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
    or public.is_super_admin()
  )
  with check (
    (public.has_org_role(organization_id, array['owner','admin']) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

-- Deliberately no client DELETE policy. Archiving preserves sales/history
-- references and is recoverable.
revoke all on public.frame_inventory from anon;
grant select, insert, update on public.frame_inventory to authenticated;

revoke all on function public.set_frame_inventory_updated_at() from public;
revoke all on function public.audit_frame_inventory_change() from public;
