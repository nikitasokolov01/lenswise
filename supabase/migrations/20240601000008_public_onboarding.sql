-- Public self-service onboarding: create an organization for an owner WITHOUT a
-- registration key. Normal customers now onboard through Stripe Checkout; the
-- webhook calls this function to atomically create the org, settings, owner
-- membership, default pricing, and an empty billing row after payment/trial
-- starts. Registration-key onboarding (redeem_key_and_create_org) is left
-- intact for Platform Admin / internal manual onboarding.
--
-- Idempotent: if the user already owns an organization, the existing org id is
-- returned (so replayed webhooks never create duplicates). Callable by the
-- service role (webhook) or by the user themselves. Runs after
-- 20240601000007_trial_once.sql; prior migrations are not edited.

create or replace function public.create_org_for_owner(
  p_user_id uuid, p_org_name text, p_default_pricing jsonb, p_schema_version integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_email  text;
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;
  if coalesce(btrim(p_org_name), '') = '' then raise exception 'office name required'; end if;

  -- Idempotency: one owner = one organization. Return the existing one if any.
  select m.organization_id into v_org_id
    from public.organization_members m
   where m.user_id = p_user_id and m.role = 'owner'
   limit 1;
  if v_org_id is not null then
    return v_org_id;
  end if;

  insert into public.organizations (name, created_by) values (btrim(p_org_name), p_user_id) returning id into v_org_id;
  insert into public.organization_settings (organization_id, office_name) values (v_org_id, btrim(p_org_name));
  insert into public.organization_members (organization_id, user_id, role) values (v_org_id, p_user_id, 'owner');
  insert into public.pricing_configurations (organization_id, config, schema_version, updated_by)
    values (v_org_id, p_default_pricing, p_schema_version, p_user_id);

  -- Empty billing row; Stripe (via the webhook) fills in status/trial/customer.
  select u.email into v_email from auth.users u where u.id = p_user_id;
  insert into public.organization_billing (organization_id, billing_email)
    values (v_org_id, v_email)
    on conflict (organization_id) do nothing;

  perform public.write_audit(v_org_id, p_user_id, 'org.create_onboarding', 'organization', v_org_id::text,
    jsonb_build_object('name', btrim(p_org_name)));

  return v_org_id;
end;
$$;
revoke all on function public.create_org_for_owner(uuid, text, jsonb, integer) from public;
grant execute on function public.create_org_for_owner(uuid, text, jsonb, integer) to authenticated, service_role;
