-- LensWise billing: Stripe becomes the SINGLE SOURCE OF TRUTH for trials and
-- subscription lifecycle. This removes the locally-invented 14-day trial.
--
-- The trial now lives entirely in Stripe: Checkout creates a subscription with
-- a 14-day Stripe trial, and the webhook is the ONLY writer of billing state.
-- LensWise never calculates or invents trial dates. Runs after
-- 20240601000003_billing.sql; prior migrations are not edited.

-- ---------------------------------------------------------------------------
-- 1. subscription_status is now NULLABLE (NULL = no Stripe subscription yet)
--    and carries no default, so nothing invents a 'trialing' state locally.
--    The existing CHECK (status in (...)) still holds; a NULL passes it.
-- ---------------------------------------------------------------------------
alter table public.organization_billing alter column subscription_status drop default;
alter table public.organization_billing alter column subscription_status drop not null;

-- ---------------------------------------------------------------------------
-- 2. Registration provisions an EMPTY billing row (customer / subscription /
--    status all NULL). No local trial is started — Stripe Checkout begins the
--    trial and the webhook fills in status + trial_end + current_period_end.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_key_and_create_org(
  p_user_id uuid, p_key text, p_org_name text, p_default_pricing jsonb, p_schema_version integer
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash   text;
  v_key    public.registration_keys%rowtype;
  v_org_id uuid;
  v_email  text;
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;
  if coalesce(btrim(p_org_name), '') = '' then raise exception 'office name required'; end if;

  v_hash := encode(digest(p_key, 'sha256'), 'hex');

  select * into v_key from public.registration_keys where key_hash = v_hash for update;
  if not found then raise exception 'invalid_registration_key'; end if;
  if v_key.revoked then raise exception 'registration_key_revoked'; end if;
  if v_key.expires_at is not null and v_key.expires_at < now() then raise exception 'registration_key_expired'; end if;
  if v_key.uses >= v_key.max_uses then raise exception 'registration_key_used_up'; end if;

  insert into public.organizations (name, created_by) values (btrim(p_org_name), p_user_id) returning id into v_org_id;
  insert into public.organization_settings (organization_id, office_name) values (v_org_id, btrim(p_org_name));
  insert into public.organization_members (organization_id, user_id, role) values (v_org_id, p_user_id, 'owner');
  insert into public.pricing_configurations (organization_id, config, schema_version, updated_by)
    values (v_org_id, p_default_pricing, p_schema_version, p_user_id);

  -- Empty billing row only. No trial is provisioned locally; Stripe owns it.
  select u.email into v_email from auth.users u where u.id = p_user_id;
  insert into public.organization_billing (organization_id, billing_email)
    values (v_org_id, v_email)
    on conflict (organization_id) do nothing;

  update public.registration_keys set uses = uses + 1 where id = v_key.id;
  insert into public.registration_key_redemptions (key_id, organization_id, redeemed_by)
    values (v_key.id, v_org_id, p_user_id);

  perform public.write_audit(v_org_id, p_user_id, 'regkey.redeem', 'registration_key', v_key.id::text,
    jsonb_build_object('label', v_key.label));

  return v_org_id;
end;
$$;
revoke all on function public.redeem_key_and_create_org(uuid, text, text, jsonb, integer) from public;
grant execute on function public.redeem_key_and_create_org(uuid, text, text, jsonb, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Migrate existing organizations. Rows already backed by a Stripe
--    subscription (stripe_subscription_id is not null) are Stripe-managed and
--    left untouched. Rows that only ever had the OLD locally-invented trial
--    (no Stripe subscription) transition cleanly to Stripe-managed billing:
--    clear the invented status/trial so the owner starts a real Stripe trial
--    via Checkout. No billing rows are deleted (no data loss).
-- ---------------------------------------------------------------------------
update public.organization_billing
   set subscription_status = null,
       trial_end = null,
       current_period_end = null,
       cancel_at_period_end = false
 where stripe_subscription_id is null;

-- ---------------------------------------------------------------------------
-- 4. Ensure every organization has a billing row (empty, Stripe-managed).
-- ---------------------------------------------------------------------------
insert into public.organization_billing (organization_id, billing_email)
select o.id,
       (select u.email
          from auth.users u
          join public.organization_members m on m.user_id = u.id
         where m.organization_id = o.id and m.role = 'owner'
         limit 1)
from public.organizations o
where not exists (
  select 1 from public.organization_billing b where b.organization_id = o.id
);
