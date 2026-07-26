-- Cover the remaining foreign-key paths reported by the database performance
-- advisor. Partial actor indexes keep the common null case out of the index.
create index if not exists inventory_movements_org_location_idx
  on public.inventory_movements (organization_id, location_id);

create index if not exists sales_voided_by_idx
  on public.sales (voided_by)
  where voided_by is not null;

create index if not exists sales_returned_by_idx
  on public.sales (returned_by)
  where returned_by is not null;
