-- Real credit card cycle model (current vs statement vs financed)

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS current_balance_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_balance_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financed_balance_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financed_balance_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_credit_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_credit_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_due_day INTEGER CHECK (payment_due_day >= 1 AND payment_due_day <= 31);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS billing_cycle_id UUID,
  ADD COLUMN IF NOT EXISTS is_statement_transaction BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.credit_card_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  due_date DATE NOT NULL,
  statement_balance_dop DECIMAL(15, 2) DEFAULT 0,
  statement_balance_usd DECIMAL(15, 2) DEFAULT 0,
  paid_amount_dop DECIMAL(15, 2) DEFAULT 0,
  paid_amount_usd DECIMAL(15, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, cycle_end_date)
);

CREATE INDEX IF NOT EXISTS idx_credit_cycles_user_id ON public.credit_card_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cycles_account_id ON public.credit_card_cycles(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_billing_cycle_id ON public.transactions(billing_cycle_id);

ALTER TABLE public.credit_card_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_card_cycles_select_own" ON public.credit_card_cycles;
DROP POLICY IF EXISTS "credit_card_cycles_insert_own" ON public.credit_card_cycles;
DROP POLICY IF EXISTS "credit_card_cycles_update_own" ON public.credit_card_cycles;
DROP POLICY IF EXISTS "credit_card_cycles_delete_own" ON public.credit_card_cycles;

CREATE POLICY "credit_card_cycles_select_own"
  ON public.credit_card_cycles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "credit_card_cycles_insert_own"
  ON public.credit_card_cycles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_card_cycles_update_own"
  ON public.credit_card_cycles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "credit_card_cycles_delete_own"
  ON public.credit_card_cycles FOR DELETE
  USING (auth.uid() = user_id);

UPDATE public.accounts
SET
  current_balance_dop = COALESCE(current_balance_dop, current_debt_dop, 0),
  current_balance_usd = COALESCE(current_balance_usd, current_debt_usd, 0),
  financed_balance_dop = COALESCE(financed_balance_dop, 0),
  financed_balance_usd = COALESCE(financed_balance_usd, 0),
  available_credit_dop = COALESCE(credit_limit_dop, 0) - COALESCE(current_balance_dop, current_debt_dop, 0),
  available_credit_usd = COALESCE(credit_limit_usd, 0) - COALESCE(current_balance_usd, current_debt_usd, 0),
  due_days_after_cutoff = COALESCE(due_days_after_cutoff, 20),
  minimum_payment_percentage = COALESCE(minimum_payment_percentage, 0.0278)
WHERE type = 'credit';

COMMIT;
