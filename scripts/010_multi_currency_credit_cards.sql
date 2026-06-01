-- Multi-currency credit card model (DOP + USD)

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS credit_limit_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_debt_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_debt_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statement_balance_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statement_balance_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_statement_amount_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_statement_amount_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_transit_dop DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_transit_usd DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closing_day INTEGER CHECK (closing_day >= 1 AND closing_day <= 31),
  ADD COLUMN IF NOT EXISTS due_days_after_cutoff INTEGER DEFAULT 20 CHECK (due_days_after_cutoff >= 1 AND due_days_after_cutoff <= 60),
  ADD COLUMN IF NOT EXISTS minimum_payment_percentage DECIMAL(8, 6) DEFAULT 0.0278,
  ADD COLUMN IF NOT EXISTS last_statement_cutoff_date DATE,
  ADD COLUMN IF NOT EXISTS statement_due_date DATE,
  ADD COLUMN IF NOT EXISTS late_fee_applied_cycle_dop DATE,
  ADD COLUMN IF NOT EXISTS late_fee_applied_cycle_usd DATE;

UPDATE public.accounts
SET
  credit_limit_dop = COALESCE(credit_limit_dop, CASE WHEN currency = 'DOP' THEN credit_limit ELSE 0 END, 0),
  credit_limit_usd = COALESCE(credit_limit_usd, CASE WHEN currency = 'USD' THEN credit_limit ELSE 0 END, 0),
  current_debt_dop = COALESCE(current_debt_dop, CASE WHEN currency = 'DOP' THEN current_debt ELSE 0 END, 0),
  current_debt_usd = COALESCE(current_debt_usd, CASE WHEN currency = 'USD' THEN current_debt ELSE 0 END, 0),
  statement_balance_dop = COALESCE(statement_balance_dop, CASE WHEN currency = 'DOP' THEN statement_balance ELSE 0 END, 0),
  statement_balance_usd = COALESCE(statement_balance_usd, CASE WHEN currency = 'USD' THEN statement_balance ELSE 0 END, 0),
  paid_statement_amount_dop = COALESCE(paid_statement_amount_dop, CASE WHEN currency = 'DOP' THEN paid_amount ELSE 0 END, 0),
  paid_statement_amount_usd = COALESCE(paid_statement_amount_usd, CASE WHEN currency = 'USD' THEN paid_amount ELSE 0 END, 0),
  closing_day = COALESCE(closing_day, closing_date),
  due_days_after_cutoff = COALESCE(due_days_after_cutoff, 20),
  minimum_payment_percentage = COALESCE(minimum_payment_percentage, 0.0278)
WHERE type = 'credit';

ALTER TABLE public.credit_payments
  ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('DOP', 'USD')),
  ADD COLUMN IF NOT EXISTS payment_kind TEXT CHECK (payment_kind IN ('balance_to_date', 'statement_balance', 'minimum_payment', 'custom'));

UPDATE public.credit_payments
SET
  currency = COALESCE(currency, 'DOP'),
  payment_kind = COALESCE(payment_kind, 'custom')
WHERE TRUE;

COMMIT;
