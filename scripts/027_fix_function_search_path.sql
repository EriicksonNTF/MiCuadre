-- Fix: set_updated_at_timestamp() function had no SET search_path
-- Supabase Advisor: function_search_path_mutable
-- This migration is idempotent and only rewrites the function body
-- with the hardened search_path. The trigger that uses it
-- (trg_billing_subscriptions_updated_at) is not recreated.

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
