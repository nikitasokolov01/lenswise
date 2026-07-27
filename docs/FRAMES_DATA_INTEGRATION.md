# Frames Data integration

LensWise keeps the licensed Frames Data catalog separate from each office's
inventory. Catalog imports update product facts; they never change an office's
quantity, reorder level, notes, or chosen retail price.

## What is ready

- `frame_catalog_items`: shared, normalized frame variants
- `catalog_import_runs`: resumable import history and counts
- `organization_catalog_connections`: per-office licensing/access status
- A protected, batched HTTP import route
- A server action that copies a licensed catalog variant into office inventory
- Full imports safely deactivate items that disappear from the latest feed
- Incremental imports update only the records received

Catalog rows are readable only when the signed-in user belongs to an active
organization with an active connection for `frames_data`. Catalog writes and
connection activation require trusted server code using the Supabase service
role.

## Environment setup

Set `FRAMES_DATA_IMPORT_SECRET` to a random value of at least 32 characters in
local development and Vercel. It protects the import endpoint and is separate
from any credential Frames Data provides.

Never send a Frames Data password, API key, FTP credential, or the LensWise
import secret to the browser.

## Licensed local proof-of-concept importer

The local importer signs in from Node.js, reads a deliberately limited catalog
sample, normalizes it, and sends it through the protected LensWise import route.
It does not copy browser cookies, store a Frames Data session, or place provider
credentials in client-side code.

Add these values to `.env.local`:

```dotenv
FRAMES_DATA_USERNAME=your-licensed-username
FRAMES_DATA_PASSWORD=your-licensed-password
FRAMES_DATA_IMPORT_SECRET=the-same-32-plus-character-secret-used-by-lenswise
FRAMES_DATA_IMPORT_URL=http://127.0.0.1:3000/api/catalog/frames-data/import
FRAMES_DATA_SEARCH_TERM=Modern
FRAMES_DATA_SAMPLE_LIMIT=100
FRAMES_DATA_REQUEST_DELAY_MS=150
```

If Next.js reports that port 3000 is already in use and starts on 3001, update
`FRAMES_DATA_IMPORT_URL` accordingly.

With LensWise running locally, first verify the adapter without writing:

```bash
npm run import:frames-data -- --dry-run --brand Modern --limit 10
```

Then run the incremental proof-of-concept import:

```bash
npm run import:frames-data -- --brand Modern --limit 100
```

The importer deliberately waits between detail requests, retries temporary
server/rate-limit errors, de-duplicates stable frame IDs, and leaves fields such
as price and UPC empty when the Frames Data catalog page does not provide them.
Incremental mode is used so a small sample cannot deactivate existing catalog
records.

### Modern Optical collection import

LensWise can target the licensed Modern Optical collections by their stable
Frames Data collection IDs instead of relying on a keyword search:

- Genevieve Paris Design (`10800`)
- Genevieve Boutique (`1088`)
- Giovani di Venezia (`1089`)
- Modern Metals (`2585`)
- Modern Plastics I (`10611`)
- Modern Plastics II (`11559`)
- ModZ (`2899`)

Run the complete collection import without a sample limit:

```bash
npm run import:frames-data -- --modern-optical
```

Each imported variant keeps its collection name. The run remains incremental,
so importing these collections does not deactivate catalog items from other
licensed manufacturers.

### Expanded office catalog import

The importer also includes the licensed designer and value collections selected
for the LensWise office catalog, plus complete brand searches for Silhouette
(`4725`), Capri Optics lines FLEXURE (`8928`), GRANDE (`8929`), MILLENNIAL
(`8921`), and SIMPLYLITE (`8932`), Ermenegildo Zegna (`8439`), and Tom Ford
(`8528`):

```bash
npm run import:frames-data -- --expanded-catalog
```

This preset uses the stable Frames Data collection/brand IDs and runs
incrementally, so it can be safely repeated to refresh those records without
deactivating other imported catalog items.

To refresh only selected entries from this preset, repeat `--target-id`:

```bash
npm run import:frames-data -- --expanded-catalog \
  --target-id 8928 --target-id 8929 --target-id 8921 --target-id 8932 \
  --target-id 8439 --target-id 8528
```

Capri detail pages sometimes photograph one color and list the remaining
available colors in an **Additional Colors** note. The importer creates a stable,
selectable variant for each named additional color. Because Frames Data does not
provide separate photography for those variants, they intentionally share the
photographed color's representative image; `rawData.colorAvailability` and
`rawData.picturedColorName` preserve that distinction.

## Private frame image mirror

Frame images are copied into the private Supabase Storage bucket
`frame-catalog-images`. The catalog keeps the original Frames Data image URL for
recovery and future refreshes, but LensWise displays mirrored images through an
authenticated route and short-lived signed Storage URLs.

Run a full or incremental image sync after importing catalog data:

```bash
npm run mirror:frame-images
```

The worker is resumable and deduplicates variants that share the same source
image. To retry only failed image downloads:

```bash
npm run mirror:frame-images -- --retry-failed
```

Downloaded working files and the resume manifest are stored in
`.frame-image-mirror/`. This directory is intentionally ignored by Git. The
worker uses the existing Supabase URL and service-role key from `.env.local`;
the service-role key must never be exposed to browser code.

Useful optional flags:

- `--concurrency 8` controls parallel downloads.
- `--attempts 3` controls retry attempts.
- `--limit 100` limits the number of source images for a test run.
- `--dry-run` reports what would be mirrored without downloading or uploading.

Catalog-backed inventory records store the LensWise image route rather than a
public vendor URL. If a mirrored object is unavailable during a transition, the
route can temporarily fall back to a validated `framesdata.com` source image.

## Import protocol

Endpoint:

`POST /api/catalog/frames-data/import`

Header:

`Authorization: Bearer <FRAMES_DATA_IMPORT_SECRET>`

The importer should send operations sequentially.

### 1. Start a run

```json
{
  "operation": "start",
  "mode": "full",
  "sourceCursor": "optional provider delivery ID or timestamp"
}
```

The response contains `runId`.

### 2. Send batches

Each batch accepts at most 500 normalized variants:

```json
{
  "operation": "batch",
  "runId": "uuid from start",
  "items": [
    {
      "providerItemId": "stable Frames Data record or variant ID",
      "brand": "Brand",
      "model": "Style",
      "colorName": "Navy",
      "upc": "012345678905",
      "eyeSizeMm": 52,
      "bridgeSizeMm": 18,
      "templeLengthMm": 140,
      "wholesalePriceCents": 3295,
      "suggestedRetailPriceCents": 9900,
      "isActive": true,
      "sourceUpdatedAt": "2026-07-25T05:00:00.000Z",
      "rawData": {}
    }
  ]
}
```

Prices are always integer cents. Empty optional values should be `null` or
omitted. `providerItemId`, `brand`, and `model` are required.

### 3. Finish

```json
{
  "operation": "finish",
  "runId": "uuid from start"
}
```

For a full import, active catalog rows not seen in that run are marked inactive.
This happens only at `finish`, so a failed partial download cannot deactivate
the catalog.

### Failure

```json
{
  "operation": "fail",
  "runId": "uuid from start",
  "error": "Sanitized error summary"
}
```

Do not include credentials or raw provider responses in the error.

## When Frames Data supplies its specification

Build one adapter from their source format into
`framesDataCatalogItemSchema` in `src/lib/catalog/framesData.ts`. Confirm:

- Stable record/variant identifier and UPC rules
- Full versus incremental delivery behavior
- Active/discontinued status codes
- Price units and licensing restrictions
- Image URL access and caching rules
- Source update timestamps or cursors
- Multi-location licensing/account identifiers
- Delivery method, authentication, retry limits, and rate limits

The adapter can then call the existing start/batch/finish import workflow
without changing inventory or database design.
