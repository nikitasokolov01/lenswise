# Stripe Billing setup for LensWise

LensWise uses **Stripe Billing** for subscriptions, **Stripe Checkout** for
sign-up/upgrade, the hosted **Stripe Customer Portal** for billing management,
and **Stripe Webhooks** as the source of truth for subscription state.

Billing model: **one organization = one Stripe customer = one subscription.**
Employees inherit access from their organization. **Stripe is the single source
of truth** for the trial, subscription status, trial end, and renewal date —
LensWise never runs its own trial or invents trial dates. Registration creates
an **empty** billing record; the owner starts the **14-day free trial** from the
Billing page, which opens Stripe Checkout with a Stripe-managed trial
(`trial_period_days: 14`, no charge today). The webhook grants access once Stripe
reports `trialing`/`active`; after the trial an active subscription is required.

There is **one plan**: **LensWise Professional**, a monthly recurring
subscription. Its Price ID is read from `STRIPE_PRICE_ID` — no Stripe IDs are
hardcoded.

---

## 1. Create a Stripe account and use Test mode

1. Sign up at https://dashboard.stripe.com/register (or sign in).
2. In the Dashboard, keep the **Test mode** toggle ON (top-right) for all setup
   and testing below. Everything has a separate set of keys and data in test
   mode. You will switch to live mode only at the very end.

## 2. Create the LensWise Professional product and monthly price

1. Go to **Product catalog → Add product**.
2. Name: `LensWise Professional`. (Description optional.)
3. Under **Pricing**: choose **Recurring**, set the amount and currency, and
   billing period **Monthly**.
4. Save. Open the product, find the **Price**, and copy its **Price ID**
   (starts with `price_...`). This is your `STRIPE_PRICE_ID`.

## 3. Copy your API keys

1. Go to **Developers → API keys**.
2. Copy the **Publishable key** (`pk_test_...`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Reveal and copy the **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`
   (server-only — never expose to the browser).

## 4. Install and log in to the Stripe CLI (for local webhooks)

Install: https://docs.stripe.com/stripe-cli#install (Homebrew, Scoop, or a
direct download).

```bash
stripe login
```

This opens a browser to authorize the CLI with your account.

## 5. Forward webhooks to your local app and get the signing secret

Start the LensWise dev server (`npm run dev`) in one terminal, then in another:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a **webhook signing secret** (`whsec_...`). Copy it into
`STRIPE_WEBHOOK_SECRET` in `.env.local` and restart the dev server. Keep
`stripe listen` running while you test — it forwards live test events to your
local endpoint.

Local webhook endpoint:

```text
http://localhost:3000/api/stripe/webhook
```

## 6. Configure the Customer Portal

1. Go to **Settings → Billing → Customer portal**.
2. Enable it and allow customers to: update payment methods, view invoice
   history, **cancel** subscriptions, and **resume** canceled subscriptions.
3. Under **Products**, add **LensWise Professional** so the portal can manage it.
4. Save. (In test mode you may be prompted to "Save changes" to activate the
   test-mode portal configuration.)

## 7. Add a production webhook endpoint

When deploying (see `docs/VERCEL_DEPLOYMENT.md`):

1. Go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL:

   ```text
   https://YOUR_DOMAIN/api/stripe/webhook
   ```

3. Select these events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
4. Create the endpoint, then reveal its **Signing secret** (`whsec_...`) and set
   it as the **production** `STRIPE_WEBHOOK_SECRET` in Vercel. (The production
   signing secret is different from the local `stripe listen` one.)

## 8. Environment variables

Add these to `.env.local` (local) and to Vercel (production). See `.env.example`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | public | Base URL for Checkout/Portal redirects |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | Publishable key (only Stripe value in the browser) |
| `STRIPE_SECRET_KEY` | **server-only** | Secret API key |
| `STRIPE_WEBHOOK_SECRET` | **server-only** | Webhook signature verification |
| `STRIPE_PRICE_ID` | **server-only** | LensWise Professional monthly price |

Only `NEXT_PUBLIC_*` values are exposed to the browser. `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` are read exclusively by
server-side code (`src/lib/stripe/*`, which is marked `server-only`).

---

## 9. Testing

Use Stripe's test cards (https://docs.stripe.com/testing). Keep `stripe listen`
running so webhooks reach your local app.

**Start the free trial**
1. In LensWise, open **Billing** as an Owner/Admin and click **Start Free
   Trial**.
2. In Checkout, use card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.
   (Stripe collects a payment method up front, but the 14-day trial means **no
   charge today**.)
3. Complete checkout. The `checkout.session.completed` +
   `customer.subscription.created` webhooks set the org to `trialing` with the
   Stripe `trial_end`, and access is granted. The Billing page shows "Trialing"
   and the trial-end date + days remaining (all from Stripe).

**Successful renewal / conversion**
- When the trial ends Stripe charges the card and the subscription becomes
  `active` (`customer.subscription.updated` + `invoice.paid`). The Billing page
  shows "Active" and the renewal date.

**Failed payment**
- Use `4000 0000 0000 0341` (attaches but fails on charge) or trigger a failed
  renewal via `stripe trigger invoice.payment_failed`. The org moves to
  `past_due` and the past-due banner appears (access continues with a warning).

**Cancellation**
- Click **Manage Billing** → cancel in the Customer Portal (cancel at period
  end). LensWise shows the "scheduled to end on DATE" banner; at period end the
  `customer.subscription.deleted`/`updated` webhook moves the org to `canceled`
  and access is blocked (Owners/Admins can resubscribe from Billing).

**Trial expiration**
- The trial is entirely Stripe-managed; `organization_billing.trial_end` is only
  ever a copy of Stripe's value. To preview the blocked/ending state without
  waiting 14 days, cancel the subscription in test mode, or in the Stripe
  Dashboard edit the test subscription's trial to end now.
  `customer.subscription.trial_will_end` fires ~3 days before the Stripe trial
  ends.

You can also drive events directly, e.g.:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

## 10. Go live

1. Toggle **Test mode** OFF in the Dashboard.
2. Recreate the **LensWise Professional** product + monthly price in live mode
   and copy the live **Price ID**.
3. Copy the live **publishable** and **secret** keys.
4. Add a **live** webhook endpoint (`https://YOUR_DOMAIN/api/stripe/webhook`)
   with the same events and copy its live signing secret.
5. Configure the live **Customer Portal**.
6. Update the production environment variables in Vercel with the live values
   and redeploy.
