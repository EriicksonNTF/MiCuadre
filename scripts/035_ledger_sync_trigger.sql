-- 035_ledger_sync_trigger.sql
-- Trigger que sincroniza accounts.balance automáticamente
-- tras cada INSERT en ledger_entries.
-- Elimina la necesidad de llamar syncAccountBalance() desde JS.
--
-- Pendiente aplicar cuando el proyecto no esté en read-only.
-- Mientras tanto, syncAccountBalance() en JS mantiene la consistencia.

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
    IF FOUND THEN
      SELECT ledger_calc_balance(NEW.debit_account_id) INTO v_balance;
      IF v_account.type = 'credit' THEN
        UPDATE public.accounts SET current_debt = GREATEST(v_balance, 0)
        WHERE id = NEW.debit_account_id;
      ELSE
        UPDATE public.accounts SET balance = GREATEST(v_balance, 0)
        WHERE id = NEW.debit_account_id;
      END IF;
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
    IF FOUND THEN
      SELECT ledger_calc_balance(NEW.credit_account_id) INTO v_balance;
      IF v_account.type = 'credit' THEN
        UPDATE public.accounts SET current_debt = GREATEST(v_balance, 0)
        WHERE id = NEW.credit_account_id;
      ELSE
        UPDATE public.accounts SET balance = GREATEST(v_balance, 0)
        WHERE id = NEW.credit_account_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_account_from_ledger ON public.ledger_entries;
CREATE TRIGGER trg_sync_account_from_ledger
  AFTER INSERT ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_account_from_ledger();
