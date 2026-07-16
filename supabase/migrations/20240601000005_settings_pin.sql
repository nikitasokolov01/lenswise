-- LensWise Settings PIN. Each organization has ONE settings PIN that protects
-- the organization-management area (Pricing, Billing, Team, Organization,
-- Customer Display, Security) on shared workstations / iPads. This is NOT a
-- replacement for Supabase auth, org roles, RLS, or server-side authorization —
-- a user must pass BOTH role authorization AND the PIN.
--
-- The PIN is stored ONLY as a slow password hash (bcrypt), written and verified
-- exclusively by trusted server-side actions using the service role. Runs after
-- 20240601000004_stripe_managed_trial.sql; prior migrations are not edited.

create table if not exists public.organization_security (
  organization_id         uuid primary key references public.organizations (id) on delete cascade,
  -- bcrypt hash of the PIN. NEVER the raw PIN. NULL = no PIN configured yet.
  settings_pin_hash       text,
  settings_pin_updated_at timestamptz,
  settings_pin_updated_by uuid references auth.users (id),
  -- Brute-force protection (server-managed).
  failed_attempts         integer not null default 0,
  locked_until            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Keep updated_at fresh (reuses the trigger fn from the billing migration).
drop trigger if exists organization_security_touch on public.organization_security;
create trigger organization_security_touch before update on public.organization_security
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: enabled with NO policies for authenticated/anon, so browser clients can
-- neither read the hash nor write PIN security data. All access is through
-- trusted server actions using the service role (which bypasses RLS). This also
-- prevents any cross-organization access from the client. Staff cannot touch it.
-- ---------------------------------------------------------------------------
alter table public.organization_security enable row level security;

-- Explicitly ensure the service role can operate on the table.
grant all on public.organization_security to service_role;

-- Audit actions for PIN lifecycle reuse the existing write_audit (already
-- granted to service_role in the billing migration). No PIN/hash is ever
-- written to audit metadata.
