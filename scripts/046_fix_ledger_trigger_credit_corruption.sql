-- =====================================================
-- 046_fix_ledger_trigger_credit_corruption.sql
-- Fixes trg_sync_account_from_ledger double/incorrect
-- debt updates on credit card accounts.
--
-- Bug: sync_account_from_ledger() fires on every INSERT
--   into ledger_entries and overwrites accounts.current_debt
--   using ledger_calc_balance(), which sums DOP+USD entries
--   as 1:1 (see 045_backfill_credit_debt.sql) and is
--   disconnected from the currency-aware current_debt_dop /
--   current_debt_usd values that payCreditCard() and
--   applyAccountImpact() already maintain correctly in JS.
--
--   Every ledger write for a credit account (expenses,
--   payments, commissions) re-triggers this overwrite,
--   producing the "payment reduces debt twice" symptom and
--   general drift between what the UI just set and what the
--   account shows afterward.
--
-- Fix: skip credit-type accounts entirely in the trigger.
--   JS remains the single source of truth for credit debt;
--   the trigger keeps syncing balance for cash/debit
--   accounts (single-currency, safe).
-- =====================================================

CREATE OR REPLACE FUNCTION sync_account_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance DECIMAL(18,2);
  v_account RECORD;
BEGIN
  -- debit_account_id gets -amount in ledger_calc_balance
  IF NEW.debit_account_id NOT IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) THEN
    SELECT type, currency INTO v_account
    FROM public.accounts
    WHERE id = NEW.debit_account_id;
    IF FOUND AND v_account.type != 'credit' THEN
      SELECT ledger_calc_balance(NEW.debit_account_id) INTO v_balance;
      UPDATE public.accounts SET balance = GREATEST(v_balance, 0)
      WHERE id = NEW.debit_account_id;
    END IF;
  END IF;

  -- credit_account_id gets +amount in ledger_calc_balance
  IF NEW.credit_account_id NOT IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) THEN
    SELECT type, currency INTO v_account
    FROM public.accounts
    WHERE id = NEW.credit_account_id;
    IF FOUND AND v_account.type != 'credit' THEN
      SELECT ledger_calc_balance(NEW.credit_account_id) INTO v_balance;
      UPDATE public.accounts SET balance = GREATEST(v_balance, 0)
      WHERE id = NEW.credit_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
