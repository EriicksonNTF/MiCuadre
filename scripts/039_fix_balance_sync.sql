-- 039_fix_reconcile_balance.sql
-- Fix reconcile_account_balance to account for initial balance in non-credit accounts.
--
-- Bug: reconcile_account_balance and syncAccountBalance (JS) were using
-- ledger_calc_balance directly (which only returns transaction deltas, not initial balance).
-- For non-credit accounts: balance = initial_balance + ledger_sum
--   - Initial balance was stored in accounts.balance at creation time
--   - ledger_calc_balance only returns the sum of transaction entries
--   - Result: balance was reset to 0 (or wrong value) instead of initial + transactions
--
-- Fix: for non-credit accounts, add the stored balance to the ledger sum.

CREATE OR REPLACE FUNCTION public.reconcile_account_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_account_type TEXT;
  v_stored_balance NUMERIC;
  v_ledger_balance NUMERIC;
  v_previous_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT type, balance
  INTO STRICT v_account_type, v_previous_balance
  FROM public.accounts
  WHERE id = p_account_id AND user_id = v_user_id;

  -- Get ledger transaction sum (not including initial balance)
  SELECT COALESCE(SUM(
    CASE
      WHEN le.credit_account_id = p_account_id THEN le.amount
      WHEN le.debit_account_id  = p_account_id THEN -le.amount
      ELSE 0
    END
  ), 0)
  INTO v_ledger_balance
  FROM public.ledger_entries le
  WHERE le.debit_account_id = p_account_id
     OR le.credit_account_id = p_account_id;

  IF v_account_type = 'credit' THEN
    -- Credit accounts: debt = ledger sum (no initial balance concept)
    v_new_balance := GREATEST(v_ledger_balance, 0);
    UPDATE public.accounts
    SET current_debt = v_new_balance
    WHERE id = p_account_id AND user_id = v_user_id;
  ELSE
    -- Non-credit accounts: balance = stored initial balance + ledger transaction sum
    v_stored_balance := COALESCE(v_previous_balance, 0);
    v_new_balance := GREATEST(v_stored_balance + v_ledger_balance, 0);
    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id AND user_id = v_user_id;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'account_id', p_account_id,
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance,
    'corrected', v_previous_balance != v_new_balance
  );
END;
$$;

-- Also fix the sync_account_from_ledger trigger function (035) to use the same logic.
-- This trigger is pending application (see 035_ledger_sync_trigger.sql comment),
-- but when applied it should use the correct formula.
CREATE OR REPLACE FUNCTION sync_account_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance NUMERIC;
  v_account RECORD;
BEGIN
  -- Handle debit_account_id (expense / decrease for the account)
  IF NEW.debit_account_id NOT IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) THEN
    SELECT type, currency, balance INTO v_account
    FROM public.accounts
    WHERE id = NEW.debit_account_id;
    IF FOUND THEN
      -- Get ledger sum for this account
      SELECT COALESCE(SUM(
        CASE
          WHEN le.credit_account_id = NEW.debit_account_id THEN le.amount
          WHEN le.debit_account_id  = NEW.debit_account_id THEN -le.amount
          ELSE 0
        END
      ), 0)
      INTO v_balance
      FROM public.ledger_entries le
      WHERE le.debit_account_id = NEW.debit_account_id
         OR le.credit_account_id = NEW.debit_account_id;

      IF v_account.type = 'credit' THEN
        UPDATE public.accounts SET current_debt = GREATEST(v_balance, 0)
        WHERE id = NEW.debit_account_id;
      ELSE
        -- Non-credit: balance = stored initial balance + ledger sum
        UPDATE public.accounts
        SET balance = GREATEST(COALESCE(v_account.balance, 0) + v_balance, 0)
        WHERE id = NEW.debit_account_id;
      END IF;
    END IF;
  END IF;

  -- Handle credit_account_id (income / increase for the account)
  IF NEW.credit_account_id NOT IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) THEN
    SELECT type, currency, balance INTO v_account
    FROM public.accounts
    WHERE id = NEW.credit_account_id;
    IF FOUND THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN le.credit_account_id = NEW.credit_account_id THEN le.amount
          WHEN le.debit_account_id  = NEW.credit_account_id THEN -le.amount
          ELSE 0
        END
      ), 0)
      INTO v_balance
      FROM public.ledger_entries le
      WHERE le.debit_account_id = NEW.credit_account_id
         OR le.credit_account_id = NEW.credit_account_id;

      IF v_account.type = 'credit' THEN
        UPDATE public.accounts SET current_debt = GREATEST(v_balance, 0)
        WHERE id = NEW.credit_account_id;
      ELSE
        UPDATE public.accounts
        SET balance = GREATEST(COALESCE(v_account.balance, 0) + v_balance, 0)
        WHERE id = NEW.credit_account_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;