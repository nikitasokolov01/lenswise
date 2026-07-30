# LensWise — Claude Implementation Handoff

Last updated: **2026-07-26**

This document describes the current repository state for the next coding agent.
It contains no secret values. Treat statements about code as confirmed from the
repository; confirm external Supabase, Stripe, GitHub, and Vercel state before
changing or deploying those systems.

## Current product

LensWise is a multi-tenant optical-office application for:

- guided eyewear quotes and lens selection;
- prescription and one-number/two-number PD entry;
- office pricing, insurance, discounts, and printable estimates;
- a licensed frame catalog with images, colors, sizes, and measurements;
- frame inventory, retail price, quantity, low-stock thresholds, archive, and
  permanent delete;
- location-specific inventory under one organization;
- recording externally collected cash/card sales and adjusting stock;
- voids and returns that restore linked stock;
- subscription billing and platform administration.

The Quote Builder intentionally does **not** collect patient PII. Do not add
patient names, birthdays, addresses, or other identifying fields without an
explicit product decision and a security/privacy review.

## 2026-07-26 landing and visual-system update

The original cream/teal/coral landing concept is now the real homepage at `/`.
The same component remains available at `/landing-preview` as a temporary alias.

- `src/app/page.tsx` performs the server-side auth lookup and renders
  `LandingPreview`.
- `src/app/landing-preview/LandingPreview.tsx` contains the marketing structure.
- `src/app/landing-preview/LandingPreview.module.css` contains the isolated
  marketing-page styling.
- The Apple-inspired and Hive-inspired preview routes were removed.
- The homepage uses fictional demonstration records only: generic collections,
  `LW-*` models, and `Location A`/`Location B`.
- Never place production office names, customer names, licensed real-world frame
  names, or other live account data in public marketing fixtures.

The product UI was updated to match that homepage:

- cream paper canvas: `#f7f4ec`;
- deep ink/navy: `#10243e`;
- primary teal: `#0d7c82`;
- mint: `#9fe3d6`;
- lime accent: `#d8f58c`;
- coral accent: `#ff9c7c`;
- rounded cards, pill actions/navigation, strong editorial headings, light navy
  borders, and soft shadows.

The palette is implemented with CSS variables in `src/app/globals.css` and
Tailwind mappings in `tailwind.config.ts`. Shared UI primitives in
`src/components/ui/` should be reused instead of creating ad-hoc controls.
The authenticated chrome is in `src/components/shell/AppShell.tsx`.

Important performance decision: the owner browses without hardware acceleration.
Keep the expressive layout, but do not reintroduce scroll parallax, continuous
motion, large blur/backdrop-filter layers, or expensive sticky visual scenes.
Small color transitions and static gradients are fine. Respect
`prefers-reduced-motion` for any future motion.

## Routes

- `/` — public marketing homepage.
- `/landing-preview` — temporary alias of the chosen homepage.
- `/login`, `/start-trial`, password/reset/invite routes — public auth/onboarding.
- `/app` — authenticated Quote Builder.
- `/inventory` — location-specific frame inventory and catalog browser.
- `/sales` — sales, voids, and returns for the active location.
- `/settings` — organization, pricing, customer display, security, and billing.
- `/account` — profile, password, and theme.
- `/platform-admin` — Super Admin operations.

Legacy `/admin`, `/organization`, `/billing`, and `/team` routes are redirect
stubs. Do not assume they are active product surfaces.

## Tech stack

- Next.js **14.2.35** App Router and TypeScript.
- React 18, Tailwind CSS, lucide-react, Zod.
- Supabase Auth, Postgres, Storage, RLS, and `@supabase/ssr`.
- Stripe Checkout, Customer Portal, and webhook-based subscription sync.
- Vitest for logic tests.
- Integer cents for all money calculations.

## Feature state

### Quotes and prescriptions

- Guided stages: order, prescription, lenses, add-ons, review.
- Frame-only and lens-only flows are supported.
- PD supports one total number or separate right/left values; validation prevents
  implausible input.
- The internal worksheet prints PD, frame brand/model, color, size/measurements,
  SKU, and relevant order details.
- Lens material compatibility and pricing selections auto-clear when invalid.
- Customer-facing and internal print views remain separate.

### Catalog and frame inventory

- The catalog is stored in Supabase and grouped by model with selectable
  color/size variants.
- Unavailable color/size combinations are disabled.
- Catalog selection supports several variants of the same model in one add
  operation.
- Capri lines FLEXURE, GRANDE, MILLENNIAL, and SIMPLYLITE import named
  **Additional Colors** as selectable variants. Those variants share the one
  representative photo supplied by Frames Data and are identified in `rawData`.
- The expanded catalog target list also includes Ermenegildo Zegna and Tom Ford
  by stable Frames Data brand ID.
- Catalog browsing is paginated.
- Imported/mirrored images appear in the catalog, inventory, Quote Builder frame
  selection, sales history, and internal worksheet where applicable.
- Inventory is scoped to the active organization location.
- Delete is a true inventory delete and is distinct from archive.

Frames Data integration details are in
`docs/FRAMES_DATA_INTEGRATION.md`. The web importer is a licensed-account import
utility, not a runtime dependency of the normal LensWise UI:

- `FRAMES_DATA_USERNAME` and `FRAMES_DATA_PASSWORD` are only needed when running a
  future licensed import.
- Imported catalog browsing does not need those login credentials.
- `FRAMES_DATA_IMPORT_SECRET` is required by the protected import endpoint and
  must be at least 32 characters.
- Image mirroring uses the `frame-catalog-images` Supabase Storage bucket.
- Do not commit credentials, cookies, raw licensed exports, or secret values.

### Locations

- One organization can contain multiple office locations.
- The active-location switcher is in the shared app bar.
- Inventory, quotes, printed office details, and sales use the active location.
- Multi-location setup notes are in `docs/MULTI_LOCATION.md`.

The intended business model is one organization with separately scoped
locations, not independent duplicate user accounts for each office.

### Sales and stock

- Payment is collected outside LensWise.
- Completing a sale records cash or card details and deducts one linked frame.
- Merely creating or printing a quote does not change stock.
- Idempotency prevents a completed quote from deducting inventory twice.
- Owners/admins can void a sale or record a return; linked stock is restored.
- Sales history keeps the frame snapshot and actor information.

### Auth, settings, and billing

- Supabase middleware protects authenticated routes.
- RLS isolates organizations.
- Settings are owner/admin scoped; sensitive settings use the Office PIN.
- The Office PIN is a second factor, never a role escalation.
- Billing remains reachable without the Office PIN.
- Super Admin is database-controlled; there is no UI self-promotion.
- Lifetime complimentary access is checked before Stripe status.
- Stripe trials are one per organization and are not restored after cancellation.

## Calculation guardrails

Do not change these incidentally:

- `calculateQuote()` is the single calculation entry point.
- All money is integer cents; do not introduce floating-point authoritative state.
- Insurance copay replaces retail for the covered category; it is not added on
  top.
- Allowances and itemized insurance breakdowns must remain visible.
- At most one surfacing fee is charged; the highest qualifying fee wins.
- Invalid material/lens/design combinations must not persist.
- Pricing JSON is versioned. `SCHEMA_VERSION` is currently **11**. Any schema
  change needs a version bump, a migration step in
  `migratePricingConfiguration.ts`, updated defaults, Zod validation, and tests.
- Exact technology names remain hidden from customer views unless the organization
  explicitly enables them.

## Security guardrails

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, the Frames Data import
  secret, licensed credentials, or PIN hashes to client components.
- Server mutations must check authorization even when the UI hides a control.
- Preserve RLS on all organization/location data.
- Registration keys are stored hashed and shown once.
- Stripe webhook updates must not overwrite complimentary-access fields.
- An organization disabled by Platform Admin remains blocked regardless of its
  billing state.

## Database migrations present

Do not edit migrations that may already be applied. Add a new timestamped
migration for schema changes.

Base/platform migrations:

- `20240601000000_init_schema.sql`
- `20240601000001_functions_rls.sql`
- `20240601000002_theme_preference.sql`
- `20240601000003_billing.sql`
- `20240601000004_stripe_managed_trial.sql`
- `20240601000005_settings_pin.sql`
- `20240601000006_remove_team.sql`
- `20240601000007_trial_once.sql`
- `20240601000008_public_onboarding.sql`
- `20240601000009_complimentary_access.sql`

Inventory/catalog/location/sales migrations:

- `20260725045907_frame_inventory.sql`
- `20260725050852_frame_inventory_actor_indexes.sql`
- `20260725053347_frames_data_catalog_import.sql`
- `20260725053936_catalog_import_runs_superadmin_policy.sql`
- `20260726013310_mirror_frame_catalog_images.sql`
- `20260726021237_organization_locations.sql`
- `20260726040118_allow_frame_inventory_delete.sql`
- `20260726043146_sales_inventory_movements_and_changelog.sql`
- `20260726043308_sales_inventory_movement_indexes.sql`
- `20260730210834_organization_frame_photo_visibility.sql`
- `20260730212020_lock_down_frame_photo_guard_function.sql`

Repository presence does not prove every migration is applied to production.
Check the linked Supabase project before deployment.

## Environment variable names

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LENSWISE_SUPER_ADMIN_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `FRAMES_DATA_IMPORT_SECRET`

Licensed importer only:

- `FRAMES_DATA_USERNAME`
- `FRAMES_DATA_PASSWORD`
- `FRAMES_DATA_IMPORT_URL`
- `FRAMES_DATA_SEARCH_TERM`
- `FRAMES_DATA_SAMPLE_LIMIT`
- `FRAMES_DATA_REQUEST_DELAY_MS`

See `docs/SUPABASE_SETUP.md`, `docs/STRIPE_SETUP.md`,
`docs/VERCEL_DEPLOYMENT.md`, and `docs/FRAMES_DATA_INTEGRATION.md`.

## Verification completed for this handoff

On 2026-07-26:

- `npm run typecheck` — passed.
- `npm run lint` — passed with no warnings.
- `npm test` — **22 files / 184 tests passed**.
- `npm run build` — passed; 28 routes generated.
- `/` built at 1.46 kB route size and uses the chosen landing component.
- `/landing-apple-preview` and `/landing-hive-preview` are absent from the route
  manifest.
- A source scan found no real frame names or real office names in the marketing
  page.
- Frames Data adapter tests — **10/10 passed**, including Capri
  `Additional Colors` normalization.
- Targeted licensed import for FLEXURE, GRANDE, MILLENNIAL, SIMPLYLITE,
  Ermenegildo Zegna, and Tom Ford — **495 styles / 1,604 variants**, completed
  as an incremental import.
- Full image mirror integrity pass — **16,447 unique images processed**:
  1,135 newly mirrored, 84 resumed, 15,227 verified, zero failures, and one
  source record without an available image.

The build emits a Supabase warning that Node.js 20 and below will lose support in
a future Supabase JS version. Current code still builds; plan a Node 22 runtime
upgrade before that becomes enforced.

## Suggested continuation

1. Review `/`, `/app`, `/inventory`, `/sales`, `/settings`, and the auth pages at
   desktop and tablet widths, especially the crowded authenticated app bar.
2. If the chosen landing is final, remove the `/landing-preview` alias and its
   public-path test in a later cleanup.
3. Confirm all 2026 migrations and the image Storage bucket exist in production.
4. Confirm production Vercel environment variables and Stripe webhook state.
5. Replace placeholder Privacy/Terms/contact copy with approved legal and support
   information.
6. Keep future UI work within the shared palette/primitives and avoid expensive
   animation for software-rendered browsers.

The landing/design changes in this handoff are implemented and verified locally,
but they have **not** been committed, pushed, or deployed by this handoff.
