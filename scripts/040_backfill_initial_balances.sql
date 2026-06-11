-- 040_backfill_initial_balances.sql
-- Backfill initial balances into ledger for accounts created before the
-- ledger-based balance tracking fix (before 039_fix_balance_sync).
--
-- These accounts have their initial balance in accounts.balance but NOT in
-- ledger_entries. This causes ledger_calc_balance() to return only the
-- transaction delta sum, which is wrong for these accounts.
--
-- Fix: for each non-credit account where ledger_calc_balance() returns 0
-- but accounts.balance > 0, insert an initial balance entry.

-- First, drop the reconcile function so we can recreate
DROP FUNCTION IF EXISTS public.reconcile_account_balance(UUID);

-- Recreate with correct formula: non-credit balance = GREATEST(v_ledger_balance, 0)
CREATE OR REPLACE FUNCTION public.reconcile_account_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_account_type TEXT;
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

  -- Get cumulative ledger balance (includes initial balance + all tx deltas)
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
    v_new_balance := GREATEST(v_ledger_balance, 0);
    UPDATE public.accounts
    SET current_debt = v_new_balance
    WHERE id = p_account_id AND user_id = v_user_id;
  ELSE
    -- ledger_calc_balance already includes initial balance + all tx deltas
    v_new_balance := GREATEST(v_ledger_balance, 0);
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

-- =====================================================
-- Backfill: find accounts missing initial balance in ledger
-- =====================================================
-- An account is "missing initial balance" if:
--   - It's non-credit
--   - It has NO ledger entries at all (ledger_calc_balance = 0)
--   - Its accounts.balance > 0

DO $$
DECLARE
  v_account RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_account IN
    SELECT a.id, a.user_id, a.balance, a.currency, a.name
    FROM public.accounts a
    WHERE a.type <> 'credit'
      AND a.balance > 0
      AND (
        SELECT COALESCE(SUM(
          CASE
            WHEN le.credit_account_id = a.id THEN le.amount
            WHEN le.debit_account_id  = a.id THEN -le.amount
            ELSE 0
          END
        ), 0)
        FROM public.ledger_entries le
        WHERE le.debit_account_id = a.id
           OR le.credit_account_id = a.id
      ) = 0
  LOOP
    -- Record initial balance: GLOBAL_INCOME (debit) → account (credit)
    INSERT INTO public.ledger_entries (
      id, user_id, debit_account_id, credit_account_id,
      amount, currency, entry_type, description,
      reference_id, reference_table, created_at
    ) VALUES (
      gen_random_uuid(),
      v_account.user_id,
      '00000000-0000-0000-0000-000000000001', -- GLOBAL_INCOME
      v_account.id,
      v_account.balance,
      COALESCE(v_account.currency, 'DOP'),
      'income',
      'Saldo inicial (backfill)',
      v_account.id,
      'accounts',
      NOW()
    );
    v_count := v_count + 1;
    RAISE NOTICE 'Backfilled initial balance %.2f %s for account %s (%s)',
      v_account.balance, v_account.currency, v_account.name, v_account.id;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % accounts updated', v_count;
END $$;

-- =====================================================
-- Verify: show accounts where balance != ledger_calc_balance
-- =====================================================
SELECT
  a.id,
  a.name,
  a.type,
  a.balance AS stored_balance,
  COALESCE(ledger_calc_balance(a.id), 0) AS ledger_balance,
  a.balance - COALESCE(ledger_calc_balance(a.id), 0) AS discrepancy
FROM public.accounts a
WHERE a.type <> 'credit'
  AND a.balance != COALESCE(ledger_calc_balance(a.id), 0)
ORDER BY ABS(a.balance - COALESCE(ledger_calc_balance(a.id), 0)) DESC;
