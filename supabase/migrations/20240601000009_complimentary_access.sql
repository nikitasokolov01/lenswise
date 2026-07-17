-- Platform Admin complimentary-access override. Grants an organization
-- permanent LensWise access WITHOUT a Stripe subscription, coupon, discount, or
-- $0 invoice — an internal LensWise billing override that belongs to the
-- organization (never a user, browser, email, or Stripe customer/subscription).
--
-- These columns are written ONLY by trusted server-side Platform Super Admin
-- actions using the service role. organization_billing already has RLS enabled
-- with NO client write policy, so browser clients (including organization
-- owners) cannot set these fields — RLS blocks any tenant write. Stripe webhook
-- synchronization must never touch these columns (it upserts only the Stripe
-- fields, leaving these untouched). Runs after 20240601000008_public_onboarding.sql;
-- prior migrations are not edited.

alter table public.organization_billing
  add column if not exists lifetime_complimentary boolean not null default false,
  add column if not exists lifetime_complimentary_granted_at timestamptz,
  add column if not exists lifetime_complimentary_granted_by uuid references auth.users (id) on delete set null;

-- Existing organizations keep the default (false); no organization receives
-- complimentary access automatically. Existing Stripe billing data is untouched.
