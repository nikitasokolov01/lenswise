-- Cover the audit-user foreign keys so auth-user deletion / updates do not
-- require a full frame_inventory table scan.
create index if not exists frame_inventory_created_by_idx
  on public.frame_inventory (created_by);
create index if not exists frame_inventory_updated_by_idx
  on public.frame_inventory (updated_by);
