-- Frames Data-ready catalog infrastructure.
--
-- The licensed vendor catalog is deliberately separate from organization stock:
-- catalog refreshes may update product facts, but they must never overwrite an
-- office's quantity, reorder threshold, notes, or chosen retail price.

create table if not exists public.organization_catalog_connections (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  provider              text not null check (char_length(btrim(provider)) between 1 and 50),
  status                text not null default 'pending'
                        check (status in ('pending', 'active', 'suspended', 'disabled')),
  external_account_ref  text check (
                          external_account_ref is null
                          or char_length(external_account_ref) <= 160
                        ),
  licensed_locations    smallint not null default 1
                        check (licensed_locations between 1 and 1000),
  last_synced_at        timestamptz,
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists organization_catalog_connections_provider_status_idx
  on public.organization_catalog_connections (provider, status, organization_id);
create index if not exists organization_catalog_connections_created_by_idx
  on public.organization_catalog_connections (created_by);
create index if not exists organization_catalog_connections_updated_by_idx
  on public.organization_catalog_connections (updated_by);

create table if not exists public.catalog_import_runs (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null check (char_length(btrim(provider)) between 1 and 50),
  mode                  text not null check (mode in ('full', 'incremental')),
  status                text not null default 'running'
                        check (status in ('running', 'completed', 'failed')),
  source_cursor         text check (source_cursor is null or char_length(source_cursor) <= 500),
  records_received      integer not null default 0 check (records_received >= 0),
  records_upserted      integer not null default 0 check (records_upserted >= 0),
  records_rejected      integer not null default 0 check (records_rejected >= 0),
  records_deactivated   integer not null default 0 check (records_deactivated >= 0),
  error_summary         text check (error_summary is null or char_length(error_summary) <= 2000),
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists catalog_import_runs_provider_started_idx
  on public.catalog_import_runs (provider, started_at desc);

create table if not exists public.frame_catalog_items (
  id                              uuid primary key default gen_random_uuid(),
  provider                        text not null
                                  check (char_length(btrim(provider)) between 1 and 50),
  provider_item_id                text not null
                                  check (char_length(btrim(provider_item_id)) between 1 and 160),
  manufacturer                    text check (manufacturer is null or char_length(manufacturer) <= 120),
  brand                           text not null check (char_length(btrim(brand)) between 1 and 100),
  collection                      text check (collection is null or char_length(collection) <= 120),
  model                           text not null check (char_length(btrim(model)) between 1 and 120),
  color_code                      text check (color_code is null or char_length(color_code) <= 80),
  color_name                      text check (color_name is null or char_length(color_name) <= 120),
  sku                             text check (sku is null or char_length(sku) <= 100),
  upc                             text check (upc is null or char_length(upc) <= 32),
  eye_size_mm                     smallint check (eye_size_mm between 20 and 80),
  bridge_size_mm                  smallint check (bridge_size_mm between 5 and 40),
  temple_length_mm                smallint check (temple_length_mm between 80 and 180),
  a_measurement_mm                numeric(5,2) check (a_measurement_mm > 0 and a_measurement_mm <= 100),
  b_measurement_mm                numeric(5,2) check (b_measurement_mm > 0 and b_measurement_mm <= 100),
  effective_diameter_mm           numeric(5,2) check (
                                    effective_diameter_mm > 0
                                    and effective_diameter_mm <= 120
                                  ),
  gender                          text check (gender is null or char_length(gender) <= 50),
  material                        text check (material is null or char_length(material) <= 80),
  shape                           text check (shape is null or char_length(shape) <= 80),
  frame_type                      text check (frame_type is null or char_length(frame_type) <= 80),
  rim_type                        text check (rim_type is null or char_length(rim_type) <= 80),
  wholesale_price_cents           integer check (wholesale_price_cents >= 0),
  suggested_retail_price_cents    integer check (suggested_retail_price_cents >= 0),
  image_url                       text check (image_url is null or char_length(image_url) <= 2000),
  is_active                       boolean not null default true,
  source_status                   text check (source_status is null or char_length(source_status) <= 80),
  source_updated_at               timestamptz,
  discontinued_at                 timestamptz,
  last_seen_import_run_id         uuid references public.catalog_import_runs (id) on delete set null,
  raw_data                        jsonb not null default '{}'::jsonb
                                  check (jsonb_typeof(raw_data) = 'object'),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (provider, provider_item_id)
);

create index if not exists frame_catalog_items_provider_active_brand_idx
  on public.frame_catalog_items (provider, is_active, brand, model);
create index if not exists frame_catalog_items_provider_upc_idx
  on public.frame_catalog_items (provider, upc)
  where upc is not null and btrim(upc) <> '';
create index if not exists frame_catalog_items_last_seen_run_idx
  on public.frame_catalog_items (last_seen_import_run_id);
create index if not exists frame_catalog_items_search_idx
  on public.frame_catalog_items using gin (
    to_tsvector(
      'simple',
      coalesce(brand, '') || ' ' ||
      coalesce(collection, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(color_name, '') || ' ' ||
      coalesce(sku, '') || ' ' ||
      coalesce(upc, '')
    )
  );

alter table public.frame_inventory
  add column if not exists catalog_record_id uuid
  references public.frame_catalog_items (id) on delete set null;

create index if not exists frame_inventory_catalog_record_idx
  on public.frame_inventory (catalog_record_id)
  where catalog_record_id is not null;

create or replace function public.set_catalog_row_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_catalog_connections_set_updated_at
  on public.organization_catalog_connections;
create trigger organization_catalog_connections_set_updated_at
  before update on public.organization_catalog_connections
  for each row execute function public.set_catalog_row_updated_at();

drop trigger if exists frame_catalog_items_set_updated_at on public.frame_catalog_items;
create trigger frame_catalog_items_set_updated_at
  before update on public.frame_catalog_items
  for each row execute function public.set_catalog_row_updated_at();

alter table public.organization_catalog_connections enable row level security;
alter table public.catalog_import_runs enable row level security;
alter table public.frame_catalog_items enable row level security;

drop policy if exists organization_catalog_connections_select
  on public.organization_catalog_connections;
create policy organization_catalog_connections_select
  on public.organization_catalog_connections for select
  to authenticated
  using (
    (
      public.is_org_member(organization_id)
      and public.org_is_active(organization_id)
    )
    or public.is_super_admin()
  );

-- Connection activation changes catalog licensing access. It is intentionally
-- performed only by trusted server code using the service role.

drop policy if exists frame_catalog_items_select
  on public.frame_catalog_items;
create policy frame_catalog_items_select
  on public.frame_catalog_items for select
  to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_catalog_connections connection
      where connection.provider = frame_catalog_items.provider
        and connection.status = 'active'
        and public.is_org_member(connection.organization_id)
        and public.org_is_active(connection.organization_id)
    )
  );

-- Import runs and catalog writes are server-only. The service role performs
-- batched upserts; authenticated users can only read licensed catalog rows.
revoke all on public.organization_catalog_connections from anon, authenticated;
revoke all on public.catalog_import_runs from anon, authenticated;
revoke all on public.frame_catalog_items from anon, authenticated;

grant select on public.organization_catalog_connections to authenticated;
grant select on public.frame_catalog_items to authenticated;

grant all on public.organization_catalog_connections to service_role;
grant all on public.catalog_import_runs to service_role;
grant all on public.frame_catalog_items to service_role;

revoke all on function public.set_catalog_row_updated_at() from public;
grant execute on function public.set_catalog_row_updated_at() to service_role;
