-- Sync frontend-required schema changes (non-breaking)

BEGIN;

-- 1) goal_contributions.user_id required by frontend inserts and uniform RLS
ALTER TABLE public.goal_contributions
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill from related goal owner
UPDATE public.goal_contributions gc
SET user_id = g.user_id
FROM public.goals g
WHERE gc.goal_id = g.id
  AND gc.user_id IS NULL;

-- Add FK only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'goal_contributions_user_id_fkey'
  ) THEN
    ALTER TABLE public.goal_contributions
      ADD CONSTRAINT goal_contributions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Keep nullable change non-breaking when legacy rows cannot be backfilled
-- New inserts from frontend always provide user_id.

CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id
  ON public.goal_contributions(user_id);

-- 2) Ensure RLS enabled for all app tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- 3) Replace goal_contributions policies with user_id-based ownership
DROP POLICY IF EXISTS "goal_contributions_select" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_insert" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_update" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_delete" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_select_own" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_insert_own" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_update_own" ON public.goal_contributions;
DROP POLICY IF EXISTS "goal_contributions_delete_own" ON public.goal_contributions;

CREATE POLICY "goal_contributions_select_own"
  ON public.goal_contributions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goal_contributions_insert_own"
  ON public.goal_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goal_contributions_update_own"
  ON public.goal_contributions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "goal_contributions_delete_own"
  ON public.goal_contributions FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
