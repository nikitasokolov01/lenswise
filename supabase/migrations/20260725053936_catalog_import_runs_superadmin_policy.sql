-- Import history is not organization-facing, but platform super admins need a
-- read-only audit trail. All writes remain restricted to the service role.

drop policy if exists catalog_import_runs_superadmin_select
  on public.catalog_import_runs;
create policy catalog_import_runs_superadmin_select
  on public.catalog_import_runs for select
  to authenticated
  using (public.is_super_admin());

grant select on public.catalog_import_runs to authenticated;
