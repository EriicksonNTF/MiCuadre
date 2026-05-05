BEGIN;

-- Mark users with existing financial activity as completed.
-- This prevents forcing onboarding for legacy users while
-- keeping onboarding for truly new users.
UPDATE public.profiles
SET onboarding_completed = true
WHERE onboarding_completed IS DISTINCT FROM true
  AND (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.user_id = profiles.id)
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id = profiles.id)
    OR EXISTS (SELECT 1 FROM public.goals g WHERE g.user_id = profiles.id)
    OR EXISTS (SELECT 1 FROM public.transfers tr WHERE tr.user_id = profiles.id)
  );

COMMIT;
