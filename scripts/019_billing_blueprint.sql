-- PHASE 7: Pre-Stripe billing database blueprint
-- Draft schema only. No checkout/webhooks are wired in this phase.

-- =====================================================
-- 1) Profiles fields for billing readiness
-- =====================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_ready BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- 2) Billing customers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id
  ON public.billing_customers(user_id);

-- =====================================================
-- 3) Billing subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free', 'pro')),
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_status_check;

ALTER TABLE public.billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete'));

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id
  ON public.billing_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
  ON public.billing_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status
  ON public.billing_subscriptions(user_id, status);

-- Keep updated_at fresh on every row update
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =====================================================
-- 4) Billing events (idempotency/event log)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- user_id is intentionally included to allow per-user read RLS.
  -- It may be null for system-wide events.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id
  ON public.billing_events(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_status
  ON public.billing_events(status);

-- =====================================================
-- 5) Billing plan snapshots (audit/history)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.billing_plan_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free', 'pro')),
  status TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_plan_snapshots_user_id
  ON public.billing_plan_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_plan_snapshots_captured_at
  ON public.billing_plan_snapshots(captured_at DESC);

-- =====================================================
-- 6) RLS
-- Users can read their own billing data.
-- Users cannot insert/update/delete billing records directly.
-- Service role/server code will manage writes in future Stripe phase.
-- =====================================================
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plan_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_customers_select_own ON public.billing_customers;
CREATE POLICY billing_customers_select_own
  ON public.billing_customers
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS billing_subscriptions_select_own ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_select_own
  ON public.billing_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS billing_events_select_own ON public.billing_events;
CREATE POLICY billing_events_select_own
  ON public.billing_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS billing_plan_snapshots_select_own ON public.billing_plan_snapshots;
CREATE POLICY billing_plan_snapshots_select_own
  ON public.billing_plan_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- Note: no INSERT/UPDATE/DELETE policies are created on billing tables.
-- With RLS enabled, authenticated clients are blocked from direct writes.
