# Supabase Setup Guide (LensWise SaaS)

LensWise is multi-tenant: every optical office is an **Organization** and is
fully isolated by Postgres **Row Level Security (RLS)**. This guide gets the
database, auth, and platform Super Admin working.

> Phase status: the database foundation (schema, RLS, atomic registration RPC,
> audit) and the Supabase-backed pricing repository are complete. The auth
> pages, middleware route protection, registration/platform-admin UI, and
> the LocalStorage import prompt are wired on top of this foundation.

## 1. Create the project

1. Go to <https://supabase.com> → **New project**. Choose a strong database
   password and a region close to your users.
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret — server only)

## 2. Configure Auth

1. **Authentication → Providers → Email**: keep **Email** enabled.
2. **Authentication → URL Configuration**: set **Site URL** to your app URL
   (e.g. `http://localhost:3000` for dev, `https://your-app.vercel.app` in prod)
   and add both to **Redirect URLs** (needed for password reset links).
3. Registration is **not** public — new organizations require a Super
   Admin–issued Registration Key — so you may leave "Confirm email" on or off
   per your preference. (Keys are validated server-side regardless.)

## 3. Apply the database migrations

The migrations live in `supabase/migrations/`:

- `20240601000000_init_schema.sql` — tables, indexes, constraints
- `20240601000001_functions_rls.sql` — helper functions, RLS policies, audit
  triggers, and the atomic `redeem_key_and_create_org` / `accept_invitation` /
  `promote_super_admin` functions
- `20240601000002_theme_preference.sql` — per-account light/dark/system theme
- `20240601000003_billing.sql` — `organization_billing` table + RLS and a
  backfill for existing organizations
- `20240601000004_stripe_managed_trial.sql` — makes Stripe the single source of
  truth for trials: `subscription_status` becomes nullable (no locally-invented
  trial), registration provisions an **empty** billing row, and existing
  local-only trials transition cleanly to Stripe-managed billing
- `20240601000005_settings_pin.sql` — `organization_security` table holding the
  bcrypt-hashed organization Office PIN (+ brute-force fields), RLS-locked to
  server-side/service-role access only
- `20240601000006_remove_team.sql` — Team removed: revokes the invitation-accept
  RPC and drops the `invitations` client RLS policies (historical data and the
  `invitations` / `organization_members` tables are preserved)

**Option A — Supabase CLI (recommended):**

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push        # applies everything in supabase/migrations in order
```

**Option B — SQL editor:** open **SQL Editor** in the dashboard and run the two
files in filename order (schema first, then functions/RLS).

### What the migrations create

| Table | Purpose |
| --- | --- |
| `profiles` | one row per auth user; holds `is_super_admin` |
| `organizations` | one optical office = one tenant (`active` / `disabled`) |
| `organization_settings` | office name + contact info |
| `organization_members` | membership + role (`owner` / `admin` / `staff`) |
| `registration_keys` | Super-Admin keys (hashed, never plaintext) |
| `registration_key_redemptions` | one row per successful redemption |
| `invitations` | legacy — Team removed; table/data retained but no app access |
| `pricing_configurations` | per-org pricing JSONB (existing schema, versioned) |
| `audit_log` | pricing/role/key/org/billing/settings-PIN events (never secrets) |
| `organization_billing` | per-org Stripe subscription state (read-only to clients) |
| `organization_security` | per-org Settings PIN (bcrypt hash), server-only — no client access |

RLS is enabled on **all** of them. Tenant isolation is enforced in the
database, not the frontend. `organization_billing` is **readable** by org
members but has **no client write policy** — only the service-role webhook
handler and `SECURITY DEFINER` functions write Stripe-sync fields, so a browser
client can never set itself to `active`/`trialing`.

> **Stripe.** After applying migrations, configure Stripe Billing and the
> webhook as described in **[STRIPE_SETUP.md](./STRIPE_SETUP.md)**. Registration
> creates only an **empty** billing record — **Stripe owns the trial**. The
> owner starts the 14-day free trial from the Billing page via Stripe Checkout,
> and the webhook grants access once Stripe reports `trialing`/`active`.

## 4. Bootstrap the Super Admin

There is intentionally **no UI** to become Super Admin.

1. Set `LENSWISE_SUPER_ADMIN_EMAIL` in your environment to your own email.
2. Sign up once through the app's **Register**/login flow with that email (this
   creates the `auth.users` row and its `profiles` row).
3. On first server startup the app calls, using the **service role** key:
   ```sql
   select public.promote_super_admin('you@example.com');
   ```
   You can also run this once manually in the SQL editor. A database trigger
   blocks `is_super_admin` from being changed by anyone except the service role,
   so no authenticated user can promote themselves.

## 5. Registration keys & organization creation

- Only the Super Admin can generate keys (format `LW-XXXX-XXXX-XXXX-XXXX`).
  The plaintext key is shown **once**; only its SHA‑256 hash is stored.
- A new org is created **atomically** by `redeem_key_and_create_org(...)`:
  it validates the key, creates the organization, owner membership, org
  settings, and copies the default LensWise pricing JSON — then marks the key
  redeemed. If any step fails, the whole transaction rolls back. The server
  action wraps this with service-role user creation so a failed org also rolls
  back the auth account.

## 6. Environment variables

Copy `.env.example` → `.env.local` and fill in the Supabase values from steps
1 & 4 (plus the site URL and Stripe values — see
[STRIPE_SETUP.md](./STRIPE_SETUP.md)):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # secret, server-only
LENSWISE_SUPER_ADMIN_EMAIL=you@example.com    # secret, server-only

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...        # secret, server-only
STRIPE_WEBHOOK_SECRET=whsec_...      # secret, server-only
STRIPE_PRICE_ID=price_...            # secret, server-only
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `LENSWISE_SUPER_ADMIN_EMAIL`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `STRIPE_PRICE_ID` with a
`NEXT_PUBLIC_` prefix.

## 7. Verify isolation

After creating two organizations, confirm in the SQL editor that a member of
org A cannot see org B's pricing:

```sql
-- As the anon/authenticated role (via the app), selecting another org's
-- pricing returns zero rows because of the pricing_select RLS policy.
select * from public.pricing_configurations;  -- returns only your org's row
```

## 8. Local development

```bash
npm install          # installs @supabase/supabase-js and @supabase/ssr
npm run typecheck
npm test
npm run dev
```

## 9. First-run runbook

1. **Apply migrations** (`supabase db push` or the SQL editor).
2. **Set env vars** (`.env.local` locally; Vercel in prod): the two
   `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `LENSWISE_SUPER_ADMIN_EMAIL`.
3. **Create your Auth account**: visit `/register` — but the first account has
   no key yet. Instead create your Super Admin account by signing up through
   Supabase (dashboard → Authentication → Add user) or by registering once you
   have a key. The simplest path: create the user in the Supabase dashboard with
   `LENSWISE_SUPER_ADMIN_EMAIL`, then sign in at `/login`.
4. **Bootstrap Super Admin**: on first sign-in the app promotes the matching
   email automatically (via the service role). Confirm with
   `select is_super_admin from profiles where email = '…';`.
5. **Generate the first registration key**: go to `/platform-admin` → *Generate
   a registration key*. Copy the `LW-XXXX-…` key (shown once).
6. **Register an organization**: open `/register`, paste the key, enter office
   name + owner name/email/password. On success the org, owner membership,
   settings, and default pricing are created atomically and you're signed in.
7. **Invite employees**: as Owner/Admin, go to `/team` → invite by email + role
   (Admins may invite Staff; only Owners may invite Admins). Share the copied
   invite link; the invitee accepts at `/accept-invite?token=…`.
8. **Edit pricing**: `/admin` (Owner/Admin only). Changes save to Supabase and
   are visible to every employee across devices.
9. **Migrate LocalStorage pricing**: if you used the pre-SaaS build on this
   device, the Quote Builder offers to import your local pricing into the org
   (Owner/Admin), once, without overwriting existing server pricing.

## 10. Testing tenant isolation

1. Register **two** organizations (two keys, two owners).
2. Sign in as org A's owner and set distinctive pricing in `/admin`.
3. Sign in as org B's owner — B sees its own defaults, never A's.
4. In the SQL editor as the `authenticated` role (or via the app), selecting
   `pricing_configurations` returns only your own org's row. Disabling org A in
   `/platform-admin` immediately blocks A's members (they're redirected to the
   "organization disabled" screen and RLS refuses their pricing) even with a
   live session.
