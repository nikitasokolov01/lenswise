-- Team removed. LensWise now uses a single shared-office owner account per
-- organization, so employee invitations are no longer part of the product.
--
-- This migration closes the DATABASE access paths for invitations as
-- defense-in-depth (the application no longer exposes them). Historical data is
-- preserved: no rows are deleted, and the invitations / organization_members
-- tables and existing memberships remain intact. Prior migrations are not edited.

-- Prevent authenticated clients from invoking the invitation-accept RPC.
revoke execute on function public.accept_invitation(text) from authenticated;

-- Remove the client RLS policies for invitations so browser clients can neither
-- create nor read invitations. The table and its historical rows remain; only
-- the access paths are closed. (The service role is unaffected, but the app no
-- longer calls any invitation code.)
drop policy if exists invitations_write on public.invitations;
drop policy if exists invitations_select on public.invitations;
