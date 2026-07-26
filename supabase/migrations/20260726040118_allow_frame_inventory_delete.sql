-- Owners and admins may permanently remove an inventory mistake. The
-- application additionally scopes each delete to the currently active office
-- location, while RLS remains the database-level organization boundary.
drop policy if exists frame_inventory_delete on public.frame_inventory;
create policy frame_inventory_delete
  on public.frame_inventory for delete
  to authenticated
  using (
    (
      public.has_org_role(organization_id, array['owner','admin'])
      and public.org_is_active(organization_id)
    )
    or public.is_super_admin()
  );

grant delete on public.frame_inventory to authenticated;
