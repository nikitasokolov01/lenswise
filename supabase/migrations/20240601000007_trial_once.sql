-- One free trial per organization, for the organization's entire lifetime.
--
-- The free trial belongs to the LensWise ORGANIZATION — not to a Stripe
-- subscription, user, browser, email, or payment method. Canceling, deleting,
-- or replacing a Stripe subscription must NOT restore trial eligibility. These
-- columns permanently record that an organization has redeemed its one trial.
-- Written only by trusted server-side code (webhook/service role); the table
-- already has no client write policy. Runs after
-- 20240601000006_remove_team.sql; prior migrations are not edited.

alter table public.organization_billing
  add column if not exists trial_redeemed_at timestamptz,
  add column if not exists trial_redeemed_subscription_id text;

-- Backfill: any organization that has already been on a Stripe trial (currently
-- trialing, or whose subscription ever carried a trial_end) has already redeemed
-- its one free trial and must not receive another. Existing value is preserved.
update public.organization_billing
   set trial_redeemed_at = coalesce(trial_redeemed_at, updated_at, now()),
       trial_redeemed_subscription_id = coalesce(trial_redeemed_subscription_id, stripe_subscription_id)
 where trial_redeemed_at is null
   and (subscription_status = 'trialing' or trial_end is not null);
