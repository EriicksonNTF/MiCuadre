-- Internal billing readiness (no Stripe integration yet)
-- Adds profile fields for local entitlements resolution.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'pro'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_plan_tier ON public.profiles(plan_tier);
