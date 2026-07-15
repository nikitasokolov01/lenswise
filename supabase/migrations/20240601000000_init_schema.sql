-- LensWise multi-tenant SaaS — schema
-- Phase 1 (foundation): tables, indexes, and constraints for full tenant isolation.
-- RLS, helper functions, audit triggers, and the atomic registration RPC live in
-- the companion migration 20240601000001_functions_rls.sql.

-- pgcrypto provides digest() (SHA-256 for hashing registration keys/tokens).
-- On Supabase it lives in the `extensions` schema; create it there so functions
-- can reach it via `search_path = public, extensions`. gen_random_uuid() is a
-- core function (PG13+) and needs no extension.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (created automatically by a trigger).
-- `is_super_admin` is the platform-level role. It can ONLY be set server-side
-- with the service-role key (enforced by a trigger) — never through any UI.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  full_name      text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- organizations: one optical office = one organization = one tenant boundary.
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-organization office/contact settings (Office Name, Contact Information).
create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  office_name      text,
  contact_email    text,
  contact_phone    text,
  contact_address  text,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- organization_members: membership + role within an organization.
-- Roles: owner (full), admin (pricing + employees), staff (quote builder only).
-- "super_admin" is intentionally NOT a valid org role — it is platform-level.
-- ---------------------------------------------------------------------------
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('owner', 'admin', 'staff')),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists organization_members_org_idx on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- registration_keys: created ONLY by Super Admin. The plaintext key is shown
-- once and never stored — only its SHA-256 hash (hex) is persisted.
-- Format: LW-XXXX-XXXX-XXXX-XXXX
-- ---------------------------------------------------------------------------
create table if not exists public.registration_keys (
  id         uuid primary key default gen_random_uuid(),
  key_hash   text not null unique,
  label      text,
  max_uses   integer not null default 1 check (max_uses >= 1),
  uses       integer not null default 0 check (uses >= 0),
  revoked    boolean not null default false,
  expires_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- registration_key_redemptions: one row per successful redemption.
create table if not exists public.registration_key_redemptions (
  id              uuid primary key default gen_random_uuid(),
  key_id          uuid not null references public.registration_keys (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  redeemed_by     uuid references auth.users (id),
  redeemed_at     timestamptz not null default now()
);
create index if not exists regkey_redemptions_key_idx on public.registration_key_redemptions (key_id);

-- ---------------------------------------------------------------------------
-- invitations: existing orgs invite employees WITHOUT registration keys.
-- Role is restricted to admin/staff — never owner (transfer) or super admin.
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null,
  role            text not null check (role in ('admin', 'staff')),
  token_hash      text not null unique,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by      uuid references auth.users (id),
  accepted_by     uuid references auth.users (id),
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz
);
create index if not exists invitations_org_idx on public.invitations (organization_id);
create index if not exists invitations_email_idx on public.invitations (lower(email));

-- ---------------------------------------------------------------------------
-- pricing_configurations: one active pricing config per organization, stored
-- as JSONB using the existing PricingConfiguration schema (versioned exactly
-- as the app already versions it — see schema_version).
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_configurations (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  config          jsonb not null,
  schema_version  integer not null,
  updated_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log: pricing changes, role changes, key creation, org creation,
-- org disable/enable. Never contains passwords, tokens, or secrets.
-- organization_id is null for platform-level events.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_id        uuid references auth.users (id),
  action          text not null,
  target_type     text,
  target_id       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists audit_log_org_idx on public.audit_log (organization_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);
