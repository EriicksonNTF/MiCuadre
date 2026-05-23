-- Migrates the old Business plan tier to the new Plus commercial tier.
-- Apply manually in Supabase before deploying webhook code that writes `plus`.

BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;

ALTER TABLE public.billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_plan_tier_check;

ALTER TABLE public.billing_plan_snapshots
  DROP CONSTRAINT IF EXISTS billing_plan_snapshots_plan_tier_check;

UPDATE public.profiles
SET plan_tier = 'plus'
WHERE plan_tier = 'business';

UPDATE public.billing_subscriptions
SET plan_tier = 'plus'
WHERE plan_tier = 'business';

UPDATE public.billing_plan_snapshots
SET plan_tier = 'plus'
WHERE plan_tier = 'business';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_tier_check
  CHECK (plan_tier IN ('free', 'pro', 'plus'));

ALTER TABLE public.billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_plan_tier_check
  CHECK (plan_tier IN ('free', 'pro', 'plus'));

ALTER TABLE public.billing_plan_snapshots
  ADD CONSTRAINT billing_plan_snapshots_plan_tier_check
  CHECK (plan_tier IN ('free', 'pro', 'plus'));

COMMIT;
