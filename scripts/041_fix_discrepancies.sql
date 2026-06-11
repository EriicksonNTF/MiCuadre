-- 041_fix_discrepancies.sql
-- Fix remaining balance discrepancies by recording missing initial balance
-- in the ledger for each non-credit account.
--
-- For each account where stored_balance != ledger_calc_balance:
-- 1. Calculate delta = stored_balance - ledger_calc_balance
-- 2. If delta > 0: record delta as initial balance in ledger
-- 3. Set balance = ledger_calc_balance (now = stored after step 2)

DO $$
DECLARE
  v_account RECORD;
  v_ledger_balance NUMERIC;
  v_delta NUMERIC;
  v_count INTEGER := 0;
BEGIN
  FOR v_account IN
    SELECT a.id, a.user_id, a.name, a.balance as stored,
           a.currency
    FROM public.accounts a
    WHERE a.type <> 'credit'
    ORDER BY a.balance DESC
  LOOP
    -- Get cumulative ledger balance
    SELECT COALESCE(SUM(
      CASE
        WHEN le.credit_account_id = v_account.id THEN le.amount
        WHEN le.debit_account_id  = v_account.id THEN -le.amount
        ELSE 0
      END
    ), 0)
    INTO v_ledger_balance
    FROM public.ledger_entries le
    WHERE le.debit_account_id = v_account.id
       OR le.credit_account_id = v_account.id;

    -- Check if the account needs correction
    IF v_account.stored != v_ledger_balance THEN
      v_delta := v_account.stored - v_ledger_balance;

      -- Record delta as initial balance
      INSERT INTO public.ledger_entries (
        id, user_id, debit_account_id, credit_account_id,
        amount, currency, entry_type, description,
        reference_id, reference_table, created_at
      ) VALUES (
        gen_random_uuid(),
        v_account.user_id,
        '00000000-0000-0000-0000-000000000001',
        v_account.id,
        v_delta,
        COALESCE(v_account.currency, 'DOP'),
        'income',
        'Saldo inicial (backfill ' || v_count + 1 || ')',
        v_account.id,
        'accounts',
        NOW()
      );

      -- Update stored balance to match ledger
      UPDATE public.accounts
      SET balance = GREATEST(v_ledger_balance + v_delta, 0)
      WHERE id = v_account.id;

      v_count := v_count + 1;
      RAISE NOTICE 'Fixed %: stored=%, ledger=%, delta=%', 
        v_account.name, v_account.stored, v_ledger_balance, v_delta;
    END IF;
  END LOOP;

  RAISE NOTICE 'Fixed % accounts', v_count;
END $$;

-- Verify: show remaining discrepancies
SELECT
  a.id,
  a.name,
  a.type,
  a.balance AS stored,
  COALESCE(ledger_calc_balance(a.id), 0) AS ledger,
  a.balance - COALESCE(ledger_calc_balance(a.id), 0) AS discrepancy
FROM public.accounts a
WHERE a.type <> 'credit'
  AND a.balance != COALESCE(ledger_calc_balance(a.id), 0)
ORDER BY ABS(a.balance - COALESCE(ledger_calc_balance(a.id), 0)) DESC;
