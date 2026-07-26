# Multi-location model

LensWise treats an organization as the company and subscription boundary.
Physical offices are stored in `organization_locations`.

## Shared across the company

- Team membership and roles
- Pricing configuration
- Frames Data catalog connection
- Billing subscription

## Separate per location

- Frame inventory records
- Quantity on hand
- Low-stock thresholds
- SKU and catalog-variant uniqueness
- Location details printed on estimates and internal worksheets

The active location is selected from the application header. LensWise stores the
selection in an HTTP-only cookie, but every request validates the location
against the authenticated organization before using it. Inventory mutations
derive the location on the server and never trust a location ID submitted by an
inventory form.

Existing organizations receive a primary location during migration. Existing
inventory is assigned to that primary location without changing quantities,
prices, or catalog links.

Owners and admins can add or edit locations under **Settings → Organization**.
At present, organization members can work across every active location. A
member-to-location assignment table can be added later if staff access needs to
be restricted by office.

The schema supports future per-location billing by counting active locations
within an organization. Billing enforcement and Stripe subscription quantities
are intentionally not enabled yet, so existing customers are not charged merely
by deploying this feature.
