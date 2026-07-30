-- The guard is invoked only as a trigger. It must not be exposed as a callable
-- RPC to anonymous or authenticated API clients.
revoke all on function public.prevent_org_frame_photo_visibility_change()
  from public, anon, authenticated;
