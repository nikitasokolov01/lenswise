-- Record externally collected payments without ever storing card numbers or
-- prescription/PD data. Completing a sale and decrementing frame stock happen
-- in one database transaction through the RPC below.

create table public.sales (
  id                              uuid primary key default gen_random_uuid(),
  organization_id                 uuid not null references public.organizations (id) on delete cascade,
  location_id                     uuid not null,
  idempotency_key                 uuid not null,
  status                          text not null default 'completed'
                                  check (status in ('completed', 'voided', 'returned')),
  order_type                      text not null
                                  check (order_type in ('complete_pair', 'lens_only', 'frame_only')),
  patient_responsibility_cents    integer not null
                                  check (patient_responsibility_cents between 0 and 100000000),
  payment_method                  text not null check (payment_method in ('cash', 'card')),
  card_brand                      text
                                  check (
                                    (payment_method = 'cash' and card_brand is null)
                                    or
                                    (payment_method = 'card' and card_brand in ('visa', 'mastercard', 'amex', 'discover'))
                                  ),
  external_reference              text check (external_reference is null or char_length(external_reference) <= 120),
  note                            text check (note is null or char_length(note) <= 1000),
  frame_inventory_id              uuid references public.frame_inventory (id) on delete restrict,
  frame_name                      text check (frame_name is null or char_length(frame_name) <= 240),
  frame_color                     text check (frame_color is null or char_length(frame_color) <= 160),
  frame_size                      text check (frame_size is null or char_length(frame_size) <= 80),
  frame_sku                       text check (frame_sku is null or char_length(frame_sku) <= 120),
  frame_image_url                 text check (frame_image_url is null or char_length(frame_image_url) <= 2000),
  sold_by                         uuid references auth.users (id) on delete set null,
  sold_at                         timestamptz not null default now(),
  voided_by                       uuid references auth.users (id) on delete set null,
  voided_at                       timestamptz,
  returned_by                     uuid references auth.users (id) on delete set null,
  returned_at                     timestamptz,
  reversal_reason                 text check (reversal_reason is null or char_length(reversal_reason) <= 500),
  constraint sales_organization_location_fkey
    foreign key (organization_id, location_id)
    references public.organization_locations (organization_id, id)
    on update cascade
    on delete restrict,
  constraint sales_idempotency_unique
    unique (organization_id, location_id, idempotency_key)
);

create index sales_location_sold_at_idx
  on public.sales (location_id, sold_at desc);
create index sales_organization_status_idx
  on public.sales (organization_id, status, sold_at desc);
create index sales_sold_by_idx
  on public.sales (sold_by)
  where sold_by is not null;
create index sales_frame_inventory_idx
  on public.sales (frame_inventory_id)
  where frame_inventory_id is not null;

create table public.inventory_movements (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  location_id           uuid not null,
  frame_inventory_id    uuid not null references public.frame_inventory (id) on delete restrict,
  sale_id               uuid not null references public.sales (id) on delete restrict,
  movement_type         text not null check (movement_type in ('sale', 'void', 'return')),
  quantity_delta        integer not null check (quantity_delta <> 0),
  quantity_after        integer not null check (quantity_after >= 0),
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  constraint inventory_movements_organization_location_fkey
    foreign key (organization_id, location_id)
    references public.organization_locations (organization_id, id)
    on update cascade
    on delete restrict,
  constraint inventory_movements_sale_type_unique
    unique (sale_id, movement_type)
);

create index inventory_movements_frame_created_idx
  on public.inventory_movements (frame_inventory_id, created_at desc);
create index inventory_movements_location_created_idx
  on public.inventory_movements (location_id, created_at desc);
create index inventory_movements_created_by_idx
  on public.inventory_movements (created_by)
  where created_by is not null;

-- One acknowledgement per signed-in user and release. This makes the
-- post-login What's New notice durable across browsers without tying it to an
-- organization or exposing another user's read state.
create table public.user_changelog_reads (
  user_id       uuid not null references auth.users (id) on delete cascade,
  release_id    text not null check (char_length(release_id) between 1 and 120),
  seen_at       timestamptz not null default now(),
  primary key (user_id, release_id)
);

alter table public.sales enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.user_changelog_reads enable row level security;

create policy sales_select
  on public.sales for select
  to authenticated
  using (
    (public.is_org_member(organization_id) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

create policy inventory_movements_select
  on public.inventory_movements for select
  to authenticated
  using (
    (public.is_org_member(organization_id) and public.org_is_active(organization_id))
    or public.is_super_admin()
  );

create policy user_changelog_reads_select
  on public.user_changelog_reads for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_changelog_reads_insert
  on public.user_changelog_reads for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.sales from anon;
revoke all on public.inventory_movements from anon;
revoke all on public.user_changelog_reads from anon;
grant select on public.sales to authenticated;
grant select on public.inventory_movements to authenticated;
grant select, insert on public.user_changelog_reads to authenticated;

create or replace function public.complete_external_sale(
  p_location_id uuid,
  p_frame_inventory_id uuid,
  p_idempotency_key uuid,
  p_order_type text,
  p_patient_responsibility_cents integer,
  p_payment_method text,
  p_card_brand text,
  p_external_reference text,
  p_note text,
  p_manual_frame_name text,
  p_manual_frame_color text,
  p_manual_frame_size text,
  p_manual_frame_sku text,
  p_manual_frame_image_url text
)
returns table (
  sale_id uuid,
  sale_status text,
  quantity_after integer,
  already_completed boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_sale_id uuid;
  v_sale_status text;
  v_sold_at timestamptz;
  v_quantity_after integer;
  v_frame_name text := nullif(btrim(p_manual_frame_name), '');
  v_frame_color text := nullif(btrim(p_manual_frame_color), '');
  v_frame_size text := nullif(btrim(p_manual_frame_size), '');
  v_frame_sku text := nullif(btrim(p_manual_frame_sku), '');
  v_frame_image_url text := nullif(btrim(p_manual_frame_image_url), '');
begin
  if v_user_id is null then
    raise exception 'You must be signed in to complete a sale.';
  end if;

  select location.organization_id
    into v_organization_id
  from public.organization_locations as location
  where location.id = p_location_id
    and location.is_active;

  if v_organization_id is null
     or not public.org_is_active(v_organization_id)
     or not public.is_org_member(v_organization_id) then
    raise exception 'The active office location is unavailable.';
  end if;

  if p_order_type not in ('complete_pair', 'lens_only', 'frame_only') then
    raise exception 'The order type is invalid.';
  end if;
  if p_patient_responsibility_cents is null
     or p_patient_responsibility_cents < 0
     or p_patient_responsibility_cents > 100000000 then
    raise exception 'The sale total is invalid.';
  end if;
  if p_payment_method not in ('cash', 'card') then
    raise exception 'Choose Cash or Card.';
  end if;
  if p_payment_method = 'card'
     and coalesce(p_card_brand, '') not in ('visa', 'mastercard', 'amex', 'discover') then
    raise exception 'Choose the card brand.';
  end if;
  if p_payment_method = 'cash' and p_card_brand is not null then
    raise exception 'Cash payments cannot include a card brand.';
  end if;

  if p_frame_inventory_id is not null then
    select
      nullif(btrim(concat_ws(' ', inventory.brand, inventory.model)), ''),
      nullif(btrim(inventory.color), ''),
      nullif(
        concat_ws(
          '-',
          case
            when inventory.eye_size_mm is not null or inventory.bridge_size_mm is not null
              then concat(coalesce(inventory.eye_size_mm::text, '—'), '-', coalesce(inventory.bridge_size_mm::text, '—'))
          end,
          inventory.temple_length_mm::text
        ),
        ''
      ),
      nullif(btrim(inventory.sku), ''),
      nullif(btrim(inventory.image_url), '')
      into v_frame_name, v_frame_color, v_frame_size, v_frame_sku, v_frame_image_url
    from public.frame_inventory as inventory
    where inventory.id = p_frame_inventory_id
      and inventory.organization_id = v_organization_id
      and inventory.location_id = p_location_id
      and inventory.is_active;

    if not found then
      raise exception 'That inventory frame is no longer available at this location.';
    end if;
  end if;

  insert into public.sales (
    organization_id,
    location_id,
    idempotency_key,
    order_type,
    patient_responsibility_cents,
    payment_method,
    card_brand,
    external_reference,
    note,
    frame_inventory_id,
    frame_name,
    frame_color,
    frame_size,
    frame_sku,
    frame_image_url,
    sold_by
  )
  values (
    v_organization_id,
    p_location_id,
    p_idempotency_key,
    p_order_type,
    p_patient_responsibility_cents,
    p_payment_method,
    case when p_payment_method = 'card' then p_card_brand else null end,
    nullif(btrim(p_external_reference), ''),
    nullif(btrim(p_note), ''),
    p_frame_inventory_id,
    v_frame_name,
    v_frame_color,
    v_frame_size,
    v_frame_sku,
    v_frame_image_url,
    v_user_id
  )
  on conflict (organization_id, location_id, idempotency_key) do nothing
  returning id, status, sold_at
  into v_sale_id, v_sale_status, v_sold_at;

  if v_sale_id is null then
    select existing_sale.id, existing_sale.status, existing_sale.sold_at
      into v_sale_id, v_sale_status, v_sold_at
    from public.sales as existing_sale
    where existing_sale.organization_id = v_organization_id
      and existing_sale.location_id = p_location_id
      and existing_sale.idempotency_key = p_idempotency_key;

    select movement.quantity_after
      into v_quantity_after
    from public.inventory_movements as movement
    where movement.sale_id = v_sale_id
      and movement.movement_type = 'sale';

    return query
      select v_sale_id, v_sale_status, v_quantity_after, true, v_sold_at;
    return;
  end if;

  if p_frame_inventory_id is not null then
    update public.frame_inventory
    set
      quantity_on_hand = quantity_on_hand - 1,
      updated_by = v_user_id
    where id = p_frame_inventory_id
      and organization_id = v_organization_id
      and location_id = p_location_id
      and is_active
      and quantity_on_hand > 0
    returning frame_inventory.quantity_on_hand
    into v_quantity_after;

    if not found then
      raise exception 'This frame is out of stock. Refresh the quote before completing the sale.';
    end if;

    insert into public.inventory_movements (
      organization_id,
      location_id,
      frame_inventory_id,
      sale_id,
      movement_type,
      quantity_delta,
      quantity_after,
      created_by
    )
    values (
      v_organization_id,
      p_location_id,
      p_frame_inventory_id,
      v_sale_id,
      'sale',
      -1,
      v_quantity_after,
      v_user_id
    );
  end if;

  perform public.write_audit(
    v_organization_id,
    v_user_id,
    'sale.complete',
    'sale',
    v_sale_id::text,
    jsonb_build_object(
      'location_id', p_location_id,
      'payment_method', p_payment_method,
      'card_brand', case when p_payment_method = 'card' then p_card_brand else null end,
      'frame_inventory_id', p_frame_inventory_id,
      'patient_responsibility_cents', p_patient_responsibility_cents
    )
  );

  return query
    select v_sale_id, 'completed'::text, v_quantity_after, false, v_sold_at;
end;
$$;

create or replace function public.reverse_external_sale(
  p_sale_id uuid,
  p_outcome text,
  p_reason text
)
returns table (
  sale_id uuid,
  sale_status text,
  quantity_after integer,
  already_reversed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales;
  v_quantity_after integer;
  v_movement_type text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to change a sale.';
  end if;
  if p_outcome not in ('voided', 'returned') then
    raise exception 'Choose Void Sale or Return to Inventory.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Enter a short reason for this change.';
  end if;

  select *
    into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'That sale could not be found.';
  end if;

  if not public.org_is_active(v_sale.organization_id)
     or not (
       public.has_org_role(v_sale.organization_id, array['owner', 'admin'])
       or public.is_super_admin()
     ) then
    raise exception 'Only an owner or admin can void or return a sale.';
  end if;

  if v_sale.status = p_outcome then
    if v_sale.frame_inventory_id is not null then
      select movement.quantity_after
        into v_quantity_after
      from public.inventory_movements as movement
      where movement.sale_id = v_sale.id
        and movement.movement_type = case when p_outcome = 'voided' then 'void' else 'return' end;
    end if;

    return query
      select v_sale.id, v_sale.status, v_quantity_after, true;
    return;
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'This sale has already been reversed.';
  end if;

  v_movement_type := case when p_outcome = 'voided' then 'void' else 'return' end;

  if v_sale.frame_inventory_id is not null then
    update public.frame_inventory
    set
      quantity_on_hand = quantity_on_hand + 1,
      updated_by = v_user_id
    where id = v_sale.frame_inventory_id
      and organization_id = v_sale.organization_id
      and location_id = v_sale.location_id
    returning frame_inventory.quantity_on_hand
    into v_quantity_after;

    if not found then
      raise exception 'The linked inventory frame is unavailable and stock could not be restored.';
    end if;

    insert into public.inventory_movements (
      organization_id,
      location_id,
      frame_inventory_id,
      sale_id,
      movement_type,
      quantity_delta,
      quantity_after,
      created_by
    )
    values (
      v_sale.organization_id,
      v_sale.location_id,
      v_sale.frame_inventory_id,
      v_sale.id,
      v_movement_type,
      1,
      v_quantity_after,
      v_user_id
    );
  end if;

  update public.sales
  set
    status = p_outcome,
    voided_by = case when p_outcome = 'voided' then v_user_id else voided_by end,
    voided_at = case when p_outcome = 'voided' then now() else voided_at end,
    returned_by = case when p_outcome = 'returned' then v_user_id else returned_by end,
    returned_at = case when p_outcome = 'returned' then now() else returned_at end,
    reversal_reason = btrim(p_reason)
  where id = v_sale.id;

  perform public.write_audit(
    v_sale.organization_id,
    v_user_id,
    case when p_outcome = 'voided' then 'sale.void' else 'sale.return' end,
    'sale',
    v_sale.id::text,
    jsonb_build_object(
      'location_id', v_sale.location_id,
      'frame_inventory_id', v_sale.frame_inventory_id,
      'reason', btrim(p_reason)
    )
  );

  return query
    select v_sale.id, p_outcome, v_quantity_after, false;
end;
$$;

revoke all on function public.complete_external_sale(
  uuid, uuid, uuid, text, integer, text, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.complete_external_sale(
  uuid, uuid, uuid, text, integer, text, text, text, text, text, text, text, text, text
) from anon;
grant execute on function public.complete_external_sale(
  uuid, uuid, uuid, text, integer, text, text, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.reverse_external_sale(uuid, text, text) from public;
revoke all on function public.reverse_external_sale(uuid, text, text) from anon;
grant execute on function public.reverse_external_sale(uuid, text, text) to authenticated;
