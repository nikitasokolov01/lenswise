# LensWise — Optical Quote Builder

A proof-of-concept, in-office optical quote builder. An optician configures a pair
of glasses (frame, lens type, material, coating, photochromic option) in front of a
patient and instantly sees a clear, itemized price breakdown, including retail total,
insurance contribution, discounts, and final patient responsibility.

**This is an anonymous tool.** It does not collect, request, or store patient names,
dates of birth, prescriptions, insurance member IDs, phone numbers, addresses, medical
information, or any other personally identifying information. Free-text fields (custom
frame descriptions, adjustment labels, manual-override notes) are for short, anonymous
labels only — e.g. "Designer frame" or "Manager-approved package price" — never for
identifying a patient. Please do not enter PHI/PII into any field in this app.

**All pricing shown is demonstration data.** Every price is clearly fictional and must
be replaced with the office's own approved price list in Admin Pricing before this tool
is used operationally. Do not treat the seeded numbers as accurate or industry-standard.

## What it does

- **Quote Builder**: a guided, step-by-step flow (frame → lens type → material →
  coating → photochromic → insurance method → adjustments) with a live, sticky price
  summary that recalculates instantly as selections change.
- **Patient View**: a simplified, full-screen view suitable for turning the iPad
  toward the patient — shows only products, plain-language descriptions, retail value,
  insurance contribution, and patient responsibility. No admin controls, internal
  notes, or technical fields are ever shown here.
- **Admin Pricing**: a PIN-gated screen for editing lens types, progressive designs,
  the lens material price matrix, coatings, photochromic products/colors, default
  allowances/copays, the Transitions custom-color surfacing fee, and office display
  text. Supports add / edit / disable / delete / reorder / save / restore-defaults.
- **Print & copy**: a clean, one-page print stylesheet and a "copy quote summary"
  action that puts a plain-text summary on the clipboard.

## Local setup

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The Quote Builder is the home page; Admin Pricing is at
`/admin`.

To verify everything before deploying:

```bash
npm run typecheck   # TypeScript, no emit
npm run lint         # ESLint (next/core-web-vitals)
npm test             # Vitest unit tests for the calculation engine
npm run build         # Production build
```

## Changing the demonstration admin PIN

Admin Pricing is protected by a simple PIN screen, intended only as a light deterrent
for an internal proof of concept — **it is not real authentication** and is not secure
enough to protect real business data. The PIN is read from an environment variable:

```
NEXT_PUBLIC_DEMO_ADMIN_PIN=1234
```

Copy `.env.example` to `.env.local` and set your own value:

```bash
cp .env.example .env.local
```

If the variable is not set, the app falls back to the default PIN `1234` and shows a
visible warning in the Admin Pricing unlock screen so nobody mistakes it for real
security. Because `NEXT_PUBLIC_*` variables are bundled into client-side JavaScript,
treat this PIN as visible to anyone with browser developer tools — again, this is
demonstration-level protection only.

## How pricing works

Lens type (Single Vision, Progressive, Bifocal, Lens Only, Frame Only) has no price of
its own — it only determines which options are available. The actual lens price always
comes from the selected **material's** price for that lens type (and, for Progressive,
the selected **progressive design** as well). For example, CR-39 + Single Vision has one
price, Polycarbonate + Single Vision another, and Polycarbonate + Progressive + Premium
Progressive another still. This mirrors how an office actually prices a job: type,
design, and material together determine the price, not a flat "lens type" fee plus a
separate "material upgrade."

## How to edit pricing

1. Go to `/admin` and enter the PIN.
2. Edit office name/disclaimer, lens types, progressive designs, coatings, photochromic
   products/colors, the Transitions surfacing fee, and default allowances/copays.
3. In **Lens Materials & Pricing**, expand a material to see its full price matrix — one
   row per active lens type (and one row per progressive design under Progressive).
   Enter the price and optional copay for each combination.
4. Use the up/down arrows to reorder options, the "Active" checkbox to disable an
   option without deleting it (disabled options cannot be selected in the Quote
   Builder), the trash icon to permanently delete an option, and "Add..." to create a
   new option.
5. Click **Save changes**. A banner reminds you that pricing changes are stored only
   in this browser for the proof of concept.
6. **Restore demonstration defaults** replaces all current pricing with the original
   seed data — use with care.

## How LocalStorage persistence works

All pricing configuration is persisted to the browser's `localStorage` under a single
key, accessed exclusively through a small repository abstraction:

```ts
interface PricingRepository {
  getConfiguration(): Promise<PricingConfiguration>;
  saveConfiguration(config: PricingConfiguration): Promise<void>;
  resetConfiguration(): Promise<PricingConfiguration>;
}
```

`LocalStoragePricingRepository` (in `src/lib/pricing/LocalStoragePricingRepository.ts`)
is the only file that touches `window.localStorage`. Stored data is validated with a
Zod schema on read; if it's missing or malformed, the app falls back to the seeded
demonstration configuration rather than crashing.

Completed patient quotes are **never** persisted anywhere — closing or resetting the
Quote Builder discards the in-progress quote entirely, by design.

## Limitations

- **Single-browser storage.** Pricing lives in one browser's LocalStorage. It is not
  shared across devices, staff members, or browsers, and clearing site data erases it
  (Restore Demonstration Defaults will bring back the original seed pricing).
- **Demonstration-only admin PIN.** Not real authentication — see above.
- **Per-lens-type coating overrides** exist in the data model (`priceByLensType`) but
  are not yet exposed in the Admin Pricing UI; edit the base retail price only, or
  extend `CoatingsSection.tsx` to expose per-lens-type pricing.
- **No multi-office / multi-user support.** This is a single-office, single-browser
  proof of concept.
- **No audit trail.** Pricing edits overwrite the prior configuration with no history.
- Demonstration prices are placeholders and are not real, accurate, or
  industry-standard pricing.

## Deploying to Vercel

1. Push this project to a Git repository (GitHub, GitLab, or Bitbucket).
2. In Vercel, choose **Add New → Project** and import the repository. Vercel
   auto-detects Next.js — no custom build configuration is required.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_DEMO_ADMIN_PIN` — your chosen demonstration PIN (optional; defaults
     to `1234` if omitted, with a visible warning).
4. Deploy. No database, external API keys, or paid services are required.
5. Because pricing is stored in each visitor's browser LocalStorage, every device that
   opens the deployed app starts from the same seeded demonstration pricing until
   someone edits and saves it on that device.

## Replacing LocalStorage with Supabase later

The Quote Builder and Admin Pricing UI never call `localStorage` directly — they only
depend on the `PricingRepository` interface (`src/lib/pricing/PricingRepository.ts`)
through the `usePricingConfiguration` hook. To move to Supabase (or any other backend):

1. Create a `pricing_configuration` table (or a small set of normalized tables) in
   Supabase mirroring `PricingConfiguration` from `src/lib/types.ts`.
2. Implement a new class, e.g. `SupabasePricingRepository`, that implements the same
   three methods (`getConfiguration`, `saveConfiguration`, `resetConfiguration`) using
   the Supabase client instead of `window.localStorage`.
3. Swap the exported `pricingRepository` instance in
   `src/lib/pricing/LocalStoragePricingRepository.ts` (or update
   `usePricingConfiguration.ts`'s import) to use the new class.
4. No changes are required in the calculation engine (`src/lib/calculation/`), the
   Quote Builder, Patient View, or Admin Pricing components — they only ever see a
   `PricingConfiguration` object and the repository interface.

## Calculation engine

All pricing math lives in pure, framework-free TypeScript under `src/lib/calculation/`,
so it can be unit tested in isolation and reused unchanged if the UI ever changes:

- `calculateQuote(input, configuration)` is the single entry point. It uses integer
  cents throughout (never floating point), returns a fully itemized
  `QuoteCalculationResult` (every automatic fee appears as its own line item — nothing
  is buried inside another price), keeps retail pricing separate from insurance
  contribution and from discounts, and guarantees patient responsibility never goes
  negative.
- `rules.ts` implements a small conditional-fee rules engine (currently just the
  Transitions custom-color surfacing fee). Add more automatic fees later by adding
  another rule to the `conditionalFeeRules` array — no changes to `calculateQuote`
  itself are required.
- Lens pricing itself comes from `MaterialConfig.prices`, a table of `MaterialPrice`
  entries keyed by lens type (and, for Progressive, by progressive design). The shared
  lookup lives in `src/lib/calculation/materialPricing.ts` and is used by both the
  calculation engine and the Admin Pricing / Quote Builder UI so the logic never drifts
  out of sync.
- Unit tests in `src/lib/calculation/__tests__/calculateQuote.test.ts` cover: a basic
  retail quote, a frame-only quote, insurance allowances (including unused-allowance
  reporting), insurance copays (including non-covered/included classification),
  discounts, the patient-responsibility-cannot-be-negative guarantee, the Transitions
  surfacing fee rule (gray/brown exempt, other colors trigger it, and only for Single
  Vision), manual override, refusing to price a disabled product, pricing a Progressive
  lens via the lens type + design + material combination, and withholding a price until
  a progressive design is chosen.

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Zod · Vitest

## Reminders

- Do not enter patient names, dates of birth, prescriptions, insurance member IDs,
  phone numbers, addresses, or other PHI/PII anywhere in this application.
- Replace all demonstration pricing with your office's approved price list in Admin
  Pricing before using this tool with real patients.
