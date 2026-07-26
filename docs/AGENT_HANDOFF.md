# LensWise — Technical Handoff

> Handoff for the next coding agent. **Confirmed** = verifiable in the repo.
> **Assumption / Suggestion** = my inference or recommendation, needs owner
> confirmation. No secrets are included.

---

## 1. Product goal & intended users (Confirmed)

LensWise is a **multi-tenant SaaS optical quote builder**. In front of a patient,
an optician configures a pair of glasses (frame, lens type, material, coating,
photochromic, tint, blue light, prescription) and instantly sees an itemized
price: retail total, insurance contribution, discounts, surfacing fees, and final
patient responsibility.

- **Intended users:** optical practices/offices. Each office = one **Organization**
  (one owner account, used on shared office devices/iPads). Staff use the Quote
  Builder through the signed-in office account.
- **Platform Super Admin:** LensWise-internal role for cross-org management
  (registration keys, disable/enable orgs, complimentary access).
- **Anonymity:** the Quote Builder is deliberately anonymous — no patient PII is
  collected or stored. Do not add PII fields.

## 2. Tech stack (Confirmed)

- Next.js **14.2.5** App Router, TypeScript, Tailwind (CSS-variable palette),
  Zod, Vitest (`environment: "node"`, only `src/**/*.test.ts`).
- Supabase: Auth, Postgres, Row Level Security, `@supabase/ssr`. Clients in
  `src/lib/supabase/{client,server,admin,middleware}.ts`.
- Stripe billing: `stripe@^16.12.0`, server-only client (`src/lib/stripe/*` is
  marked `server-only`).
- `bcryptjs` for the Office PIN hash. `server-only` package guards secret modules.
- Pure calculation engine in `src/lib/calculation/` (framework-free, unit-tested).

## 3. What is completed (Confirmed)

- **Quote engine**: pricing, insurance (copay replaces retail, allowances),
  prescription display toggles, high-cylinder + Transitions custom-color
  **surfacing** (selectable w/ auto-recommend, one fee max), **tints** (solid +
  gradient per color), **blue light** (independent configurable option),
  **per-material compatibility** (lens types / progressive designs). All itemized.
- **Auth & tenancy**: Supabase Auth, middleware route protection, org context,
  RLS isolation, audit log, atomic registration RPC.
- **Public onboarding**: marketing landing at `/`, `/start-trial` (no key) →
  Stripe Checkout → **webhook creates the org** (`create_org_for_owner`).
- **Stripe billing**: Checkout, Customer Portal, signature-verified webhook,
  Stripe-managed 14-day trial, **one lifetime trial per org** (`trial_redeemed_at`).
- **Settings area** (`/settings`): one PIN-protected area with sections
  Organization, Pricing, Customer Display, Security, **Billing** (Team removed).
- **Office PIN**: bcrypt hash, HTTP-only signed 15-min unlock cookie, brute-force
  cooldown, audit. **Billing is exempt** from the PIN.
- **Platform Admin**: registration keys, org disable/enable, **complimentary
  access** grant/revoke.
- **Dark mode**: `ThemeProvider` (light/dark/system), account-menu toggle, landing
  toggle; print always light.

## 4. What is unfinished / not verified (Confirmed unless noted)

- **No build/test verification ran in this environment.** The sandbox could not
  run `vitest`, `next build`, or a trustworthy `tsc` (see §6). **The owner must
  run `npm install && npm run typecheck && npm test && npm run build` locally.**
- **Migrations 0000–0009 exist in the repo but may not all be applied** to the
  live Supabase project (see §7). *Assumption:* the owner applies them.
- **Landing theme toggle for an authenticated user** writes only localStorage,
  not their account profile (account-menu toggle still persists to the profile).
  *Assumption:* acceptable; confirm if you want landing changes to sync to the
  account.
- Privacy/Terms pages and the `support@lenswise.app` contact + `lenswise.app`
  references are **placeholder copy** — need real legal text and contact.

## 5. Recommended next tasks (priority order — Suggestions)

1. **Run full local verification** (`npm install`, typecheck, `npm test`,
   `npm run build`) and apply pending Supabase migrations; fix anything that
   surfaces. Nothing here has been build-verified in-sandbox.
2. **End-to-end Stripe test in test mode**: start-trial → Checkout → webhook
   creates org → trialing → cancel → blocked → resubscribe (no 2nd trial) →
   complimentary grant/revoke. Confirm with `stripe listen`.
3. **Finalize legal/contact content** (Privacy, Terms, contact email, domain) and
   real plan price alignment between `LENSWISE_PLAN` display and `STRIPE_PRICE_ID`.
4. **Decide the fate of legacy role fields** (`admin`/`staff`) now that Team is
   removed — currently retained in DB and RLS but unused in UI (see §10).
5. **Add a lightweight render-test harness** (e.g. `@testing-library/react` +
   jsdom) so component behaviors (billing CTAs hidden when complimentary, toggle
   rendering) can be tested — currently only pure logic is unit-tested.

## 6. Rules that MUST NOT be accidentally changed (Confirmed)

**Pricing / calculation** (`src/lib/calculation/`, `src/lib/pricing/`)
- `calculateQuote()` is the single entry point; integer **cents** only, never
  floats. Every automatic fee is its own line item (nothing buried).
- **Surfacing**: only **one** surfacing fee is ever charged even if multiple
  rules qualify (winner = highest amount); high-cylinder rule requires Single
  Vision/Bifocal + a material flagged `appliesToHighCylinderSurfacing` and **not**
  `isHighIndex`; threshold is office-configurable (`highCylinderThresholdDiopters`).
  Manual override is sticky (`surfacingOverride: boolean|null`) and only
  re-evaluates when prescription/material/lens type/photochromic/config change.
- **Insurance**: copay **replaces** retail (does not add); allowance pools;
  `InsuranceBreakdown` itemization. Coverage categories retail/copay/covered.
- **Material compatibility**: empty compatibility list = compatible with all
  (back-compat). Invalid selections auto-clear.
- **Pricing config** is JSONB per org, **versioned** (`SCHEMA_VERSION`, currently
  11) with migrations in `migratePricingConfiguration.ts` + Zod validation. Bump
  the version and add a migration step for any schema change.
- Customer-facing views hide exact tech/brand/progressive names unless
  `showExactTechnologyNamesOnCustomerQuotes` is on.

**Billing access priority** (`src/lib/billing/status.ts` `billingAccess`)
1. `lifetimeComplimentary` → **full** (checked first, before Stripe).
2. Stripe `trialing`/`active` → full; `past_due` → warn; everything else
   (null/canceled/unpaid/incomplete/incomplete_expired) → **blocked**.
- Org **disabled** by Platform Admin is enforced earlier in `requireActiveOrg`
  and **always** blocks regardless of billing/complimentary.
- **One trial per org**: `trial_redeemed_at` is set once by the webhook and
  **never cleared**; cancel/delete/replace never restores trial eligibility.
- **Stripe webhook sync upserts only Stripe columns** — it must never touch
  `lifetime_complimentary*` or `trial_redeemed_*`.

**Permissions / security**
- Super Admin is DB-only, bootstrapped from `LENSWISE_SUPER_ADMIN_EMAIL`; **no UI
  self-promotion**; complimentary access never grants Super Admin.
- Office PIN is a **second factor**, never a role substitute; Staff can’t reach
  Settings even with the PIN; billing sections stay reachable without the PIN.
- `organization_billing` and `organization_security` have **no client write
  policy** — only service-role/server actions write them. Never expose the PIN
  hash or service-role key to the browser.
- Registration keys stored **hashed** (SHA-256), shown once.

## 7. Supabase migrations & DB status (Confirmed files; application = Assumption)

Files in `supabase/migrations/` (do **not** edit already-applied ones):
- `…000000_init_schema` / `…000001_functions_rls` — tables, RLS, audit, RPCs.
- `…000002_theme_preference` — `profiles.theme_preference`.
- `…000003_billing` — `organization_billing` + RLS + trial (later revised).
- `…000004_stripe_managed_trial` — Stripe owns the trial; `subscription_status`
  nullable.
- `…000005_settings_pin` — `organization_security` (bcrypt PIN, cooldown).
- `…000006_remove_team` — revokes invite RPC + drops `invitations` client
  policies (data preserved).
- `…000007_trial_once` — `trial_redeemed_at` + `trial_redeemed_subscription_id`.
- `…000008_public_onboarding` — `create_org_for_owner` keyless RPC.
- `…000009_complimentary_access` — `lifetime_complimentary` (+ granted_at/by).

**Action needed:** run `supabase db push` (or apply via SQL editor) against the
live project so 0004–0009 are present. *Assumption:* not yet all applied.
Schema note discovered: **no FK exists between `organization_members` and
`profiles`** (both reference `auth.users`) — do NOT PostgREST-embed across that
boundary; join `organization_members.user_id → profiles.id` in TypeScript.

## 8. Stripe & Vercel status (Confirmed docs; configuration = Assumption)

- Docs: `docs/STRIPE_SETUP.md`, `docs/VERCEL_DEPLOYMENT.md`, `docs/SUPABASE_SETUP.md`.
- **Required env vars** (names only — set real values locally/in Vercel; keep the
  server-only ones un-prefixed):
  - Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
  - Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `LENSWISE_SUPER_ADMIN_EMAIL`,
    `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`.
- Webhook endpoint: `POST /api/stripe/webhook` (excluded from middleware; uses raw
  body + signature verification). Events needed: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.trial_will_end`.
- The 14-day trial is set in code (`trial_period_days: 14`) — **no Stripe coupon
  needed**. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- *Assumption:* production Stripe product/price, webhook endpoint, Customer Portal,
  and Vercel env vars still need to be configured by the owner. No secret values
  are known to me.

## 9. Recently changed / partially complete (Confirmed)

Most recent work (newest first):
- **Platform Admin org table layout fix** + **landing dark-mode toggle**
  (`src/app/platform-admin/page.tsx`, `src/components/platform/OrgStatusButton.tsx`,
  `ComplimentaryAccessControl.tsx`, `src/lib/platform/orgActionLabels.ts`,
  `src/components/marketing/LandingThemeToggle.tsx`, `src/app/page.tsx`,
  `src/lib/theme/resolveTheme.ts`, `src/components/theme/ThemeProvider.tsx`).
- **Platform Admin org-loading refactor**: 4 flat admin queries + TS Map joins
  (fixed a PGRST200 caused by embedding `organization_members → profiles`).
- **Complimentary access** feature (migration 0009, `billingAccess` priority,
  Platform Admin grant/revoke, Billing page state, banners).
- **Public onboarding + landing + `/app` move** (app home moved from `/` to
  `/app`; `/` is now the public landing).
- No known half-written code. Old `/admin`, `/organization`, `/team`, `/billing`
  are redirect stubs into `/settings`. `/register` + registration-key infra remain
  but are unlinked (kept for internal manual onboarding).

## 10. Decisions from chat NOT fully documented in the repo

- **App home moved to `/app`**; `/` is the marketing landing. Guards/menus redirect
  `/`→`/app`. (Confirmed in code; note for anyone expecting the old root.)
- **Team fully removed** from the product (no employee accounts/invitations); one
  owner account per office on shared devices. `organization_members` and
  `invitations` tables + `admin`/`staff` roles **remain in the DB** (intentionally,
  to avoid a risky migration) but are **unused by the UI**. Decision to eventually
  prune them is open.
- **Trial is Stripe-managed**, not local; the earlier “local 14-day trial at
  registration” was removed. Registration/onboarding now creates an **empty**
  billing row and Stripe owns the trial.
- **Office PIN session** is a fixed 15-minute absolute expiry (spec allowed “15 min
  inactivity or another clearly defined short duration”); it’s signed with a key
  **derived from `SUPABASE_SERVICE_ROLE_KEY`** (no new env var).
- **Complimentary access** is an internal override with **no** fake Stripe
  subscription/coupon/$0 invoice.

## 11. Assumptions needing owner confirmation

- Supabase migrations 0004–0009 have **not** been applied yet — confirm and run.
- Production Stripe (product/price/webhook/portal) and Vercel env vars are **not**
  configured yet — confirm.
- `LENSWISE_PLAN` shows **$49/month** as display copy only; confirm it matches the
  real recurring price behind `STRIPE_PRICE_ID`.
- Keep `admin`/`staff` roles + `invitations`/`organization_members` tables for now
  (removal deferred) — confirm.
- `/register` staying reachable-by-URL (unlinked) for internal key onboarding —
  confirm intended.
- Placeholder legal copy + `support@lenswise.app` + `lenswise.app` must be replaced.
- Landing theme change by an authenticated user is localStorage-only (not synced to
  their profile) — confirm acceptable.

---

## Environment caveat (important, Confirmed observation)

All code was authored in a sandbox that **could not** install deps or run
`npm`/`vitest`/`next build`, and where the mounted filesystem occasionally served
stale/torn reads to shell tools (host file tools were authoritative). Therefore:
**treat the code as not-yet-CI-verified** and run a full local
`npm install && npm run typecheck && npm test && npm run build` before deploying.
`vitest` needs the platform-native `@rollup/*` binary and `next build` needs
`@next/swc-*`; a fresh `npm install` on the target OS provides them.
