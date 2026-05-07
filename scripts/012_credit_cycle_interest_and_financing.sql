-- Extend credit cycle model with financing and interest tracking

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS annual_interest_rate DECIMAL(8, 6) DEFAULT 0.60,
  ADD COLUMN IF NOT EXISTS minimum_payment_percentage DECIMAL(8, 6) DEFAULT 0.0278;

ALTER TABLE public.credit_card_cycles
  ADD COLUMN IF NOT EXISTS financed_amount_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financed_amount_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_amount_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_amount_usd DECIMAL(15, 2) DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'credit_card_cycles'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.credit_card_cycles
      DROP CONSTRAINT IF EXISTS credit_card_cycles_status_check;

    ALTER TABLE public.credit_card_cycles
      ADD CONSTRAINT credit_card_cycles_status_check
      CHECK (status IN ('open', 'closed', 'paid', 'partial', 'overdue', 'financed'));
  END IF;
END $$;

UPDATE public.accounts
SET
  annual_interest_rate = COALESCE(annual_interest_rate, 0.60),
  minimum_payment_percentage = COALESCE(minimum_payment_percentage, 0.0278)
WHERE type = 'credit';

COMMIT;
