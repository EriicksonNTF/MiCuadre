-- 033_opening_balances.sql
-- Crea entradas de apertura para que ledger_entries refleje
-- el saldo inicial de cada cuenta antes del primer movimiento registrado.
-- Calcula: opening = stored_balance - ledger_balance

-- Función auxiliar: calcular cuánto falta para que ledger = stored
CREATE OR REPLACE FUNCTION public.ledger_opening_needed(p_account_id UUID)
RETURNS DECIMAL(18,2)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_account_type TEXT;
  v_stored DECIMAL(18,2);
  v_ledger DECIMAL(18,2);
BEGIN
  SELECT type,
    CASE WHEN type = 'credit' THEN COALESCE(current_debt_dop, current_debt, 0)
         ELSE COALESCE(balance, 0) END
  INTO v_account_type, v_stored
  FROM public.accounts WHERE id = p_account_id;

  v_ledger := public.ledger_calc_balance(p_account_id);
  RETURN ROUND((v_stored - v_ledger) * 100) / 100;
END;
$$;

-- Insertar opening balance para cada cuenta que lo necesite
-- Débito/Cash: opening → debit=GLOBAL_INCOME, credit=account (el saldo inicial es como un ingreso)
-- Crédito:      opening → debit=GLOBAL_EXPENSE, credit=account (la deuda inicial es como un gasto)
DO $$
DECLARE
  rec RECORD;
  v_opening DECIMAL(18,2);
  v_account_type TEXT;
BEGIN
  FOR rec IN SELECT id, type FROM public.accounts WHERE is_active = true LOOP
    SELECT type INTO v_account_type FROM public.accounts WHERE id = rec.id;
    v_opening := public.ledger_opening_needed(rec.id);

    IF ABS(v_opening) >= 0.01 THEN
      IF v_account_type = 'credit' AND v_opening > 0 THEN
        -- La deuda inicial de la tarjeta se registra como aumento de pasivo
        INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, created_at)
        SELECT
          a.user_id,
          '00000000-0000-0000-0000-000000000002'::uuid,
          rec.id,
          v_opening,
          a.currency,
          'Saldo inicial de tarjeta de crédito',
          'expense',
          rec.id,
          a.created_at
        FROM public.accounts a WHERE a.id = rec.id;
      ELSIF v_opening > 0 THEN
        -- Saldo inicial de cuenta débito/cash
        INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, created_at)
        SELECT
          a.user_id,
          '00000000-0000-0000-0000-000000000001'::uuid,
          rec.id,
          v_opening,
          a.currency,
          'Saldo inicial de cuenta',
          'income',
          rec.id,
          a.created_at
        FROM public.accounts a WHERE a.id = rec.id;
      ELSIF v_opening < 0 THEN
        -- Saldo negativo (atípico para débito, común si el ledger tiene más que stored)
        INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, created_at)
        SELECT
          a.user_id,
          rec.id,
          '00000000-0000-0000-0000-000000000002'::uuid,
          ABS(v_opening),
          a.currency,
          'Ajuste de apertura (saldo ledger > stored)',
          'expense',
          rec.id,
          a.created_at
        FROM public.accounts a WHERE a.id = rec.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Verificación final
SELECT COUNT(*) AS inconsistentes_restantes FROM (
  SELECT a.id FROM public.accounts a WHERE a.is_active = true
  AND NOT (SELECT public.ledger_check_account(a.id) -> 'consistent')::text::boolean
) sub;
