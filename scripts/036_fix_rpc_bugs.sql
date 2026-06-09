-- 036_fix_rpc_bugs.sql
-- Corrige bugs en RPCs identificados en QA Fase 5
-- Pendiente aplicar cuando el proyecto no esté en read-only.

-- =====================================================
-- R2: ledger_check_account — usar current_debt_usd para USD
-- =====================================================
CREATE OR REPLACE FUNCTION public.ledger_check_account(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_account_type TEXT;
  v_account_currency TEXT;
  v_stored_balance DECIMAL(18,2);
  v_ledger_balance DECIMAL(18,2);
  v_discrepancy DECIMAL(18,2);
BEGIN
  SELECT type, COALESCE(currency, 'DOP'),
    CASE
      WHEN type = 'credit' AND COALESCE(currency, 'DOP') = 'USD' THEN COALESCE(current_debt_usd, 0)
      WHEN type = 'credit' THEN COALESCE(current_debt_dop, current_debt, 0)
      ELSE COALESCE(balance, 0)
    END
  INTO v_account_type, v_account_currency, v_stored_balance
  FROM public.accounts
  WHERE id = p_account_id;

  v_ledger_balance := public.ledger_calc_balance(p_account_id);
  v_discrepancy := ROUND((v_stored_balance - v_ledger_balance) * 100) / 100;

  RETURN JSONB_BUILD_OBJECT(
    'account_id', p_account_id,
    'account_type', v_account_type,
    'account_currency', v_account_currency,
    'stored_balance', v_stored_balance,
    'ledger_balance', v_ledger_balance,
    'discrepancy', v_discrepancy,
    'consistent', ABS(v_discrepancy) < 0.01
  );
END;
$$;

-- =====================================================
-- R1: reconcile_account_balance — usar ledger en vez de sum manual
-- =====================================================
CREATE OR REPLACE FUNCTION public.reconcile_account_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_account_type TEXT;
  v_previous_balance NUMERIC;
  v_calculated_balance NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT type, balance
  INTO STRICT v_account_type, v_previous_balance
  FROM public.accounts
  WHERE id = p_account_id AND user_id = v_user_id;

  -- Usar ledger como fuente de verdad
  SELECT public.ledger_calc_balance(p_account_id) INTO v_calculated_balance;

  IF v_account_type = 'credit' THEN
    UPDATE public.accounts
    SET current_debt = GREATEST(v_calculated_balance, 0)
    WHERE id = p_account_id AND user_id = v_user_id;
  ELSE
    UPDATE public.accounts
    SET balance = GREATEST(v_calculated_balance, 0)
    WHERE id = p_account_id AND user_id = v_user_id;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'account_id', p_account_id,
    'previous_balance', v_previous_balance,
    'new_balance', GREATEST(v_calculated_balance, 0),
    'corrected', v_previous_balance != GREATEST(v_calculated_balance, 0)
  );
END;
$$;

-- =====================================================
-- Nota: create_transfer_safe tiene balance updates redundantes
-- que serán eliminados cuando el trigger 035 esté activo.
-- Por ahora se quedan (no rompen nada, solo son duplicados
-- con el syncAccountBalance de JS).
-- =====================================================
