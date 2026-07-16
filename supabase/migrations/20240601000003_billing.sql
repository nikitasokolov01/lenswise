-- LensWise billing (Stripe). One organization = one Stripe customer = one
-- subscription. Employees inherit access from their organization; there is no
-- per-employee billing. Runs after 20240601000001_functions_rls.sql.
--
-- Stripe synchronization fields are written ONLY by trusted server-side code:
-- the service-role webhook handler and SECURITY DEFINER functions. There is no
-- client write policy, so a browser client can never set itself to 'active' or
-- 'trialing'. Members may READ their own organization's subscription status.

-- ---------------------------------------------------------------------------
-- organization_billing: one row per organization (created on registration).
-- ---------------------------------------------------------------------------
create table if not exists public.organization_billing (
  organization_id        uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  stripe_price_id        text,
  -- The ACTUAL Stripe subscription status is stored verbatim.
  subscription_status    text not null default 'trialing'
                           check (subscription_status in (
                             'trialing', 'active', 'past_due',
                             'canceled', 'unpaid', 'incomplete', 'incomplete_expired'
                           )),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  trial_end              timestamptz,
  billing_email          text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists organization_billing_customer_idx
  on public.organization_billing (stripe_customer_id);
create index if not exists organization_billing_subscription_idx
  on public.organization_billing (stripe_subscription_id);
create index if not exists organization_billing_status_idx
  on public.organization_billing (subscription_status);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists organization_billing_touch on public.organization_billing;
create trigger organization_billing_touch before update on public.organization_billing
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: members (and super admin) may READ; nobody may write from the browser.
-- Only the service role (webhooks/server actions) and SECURITY DEFINER
-- functions write the Stripe-sync fields.
-- ---------------------------------------------------------------------------
alter table public.organization_billing enable row level security;

drop policy if exists org_billing_select on public.organization_billing;
create policy org_billing_select on public.organization_billing for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

-- No insert/update/delete policies are defined on purpose: authenticated
-- clients cannot modify billing state. The service role bypasses RLS.

-- Audit billing changes: allow the trusted service role to record entries.
grant execute on function public.write_audit(uuid, uuid, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Registration now also provisions a 14-day free trial billing row atomically
-- with the organization. No payment method is required to register.
-- (create or replace only — the original migration file is left untouched.)
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

  -- Start the 14-day trial at organization creation.
  select u.email into v_email from auth.users u where u.id = p_user_id;
  insert into public.organization_billing (organization_id, subscription_status, trial_end, billing_email)
    values (v_org_id, 'trialing', now() + interval '14 days', v_email)
    on conflict (organization_id) do nothing;

  update public.registration_keys set uses = uses + 1 where id = v_key.id;
  insert into public.registration_key_redemptions (key_id, organization_id, redeemed_by)
    values (v_key.id, v_org_id, p_user_id);

  perform public.write_audit(v_org_id, p_user_id, 'regkey.redeem', 'registration_key', v_key.id::text,
    jsonb_build_object('label', v_key.label));
  perform public.write_audit(v_org_id, p_user_id, 'billing.trial_started', 'organization_billing', v_org_id::text,
    jsonb_build_object('trial_days', 14));

  return v_org_id;
end;
$$;
revoke all on function public.redeem_key_and_create_org(uuid, text, text, jsonb, integer) from public;
grant execute on function public.redeem_key_and_create_org(uuid, text, text, jsonb, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill: any organization created before billing existed gets a 14-day
-- trial row so the access layer always finds a status.
-- ---------------------------------------------------------------------------
insert into public.organization_billing (organization_id, subscription_status, trial_end, billing_email)
select o.id,
       'trialing',
       now() + interval '14 days',
       (select u.email
          from auth.users u
          join public.organization_members m on m.user_id = u.id
         where m.organization_id = o.id and m.role = 'owner'
         limit 1)
from public.organizations o
where not exists (
  select 1 from public.organization_billing b where b.organization_id = o.id
);
