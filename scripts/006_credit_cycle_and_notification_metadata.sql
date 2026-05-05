-- Credit cycle model + notification metadata

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS statement_balance DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cycle_start_date DATE,
  ADD COLUMN IF NOT EXISTS cycle_end_date DATE;

UPDATE public.accounts
SET
  statement_balance = COALESCE(statement_balance, current_debt, 0),
  pending_amount = COALESCE(pending_amount, current_debt, 0),
  paid_amount = COALESCE(paid_amount, 0)
WHERE type = 'credit';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin
  ON public.notifications USING gin (metadata);

COMMIT;
