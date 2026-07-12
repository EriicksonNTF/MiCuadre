// Apply sync_account_from_ledger trigger
// Uses Supabase Management API with the access token

const SUPABASE_ACCESS_TOKEN = "sbp_REMOVED"
const PROJECT_REF = "zmbxriaftswtxjihatfr"

const sql = `
-- Create or replace the trigger function (using the latest version from 039)
CREATE OR REPLACE FUNCTION sync_account_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
        IF v_account.currency = 'USD' THEN
          UPDATE public.accounts SET current_debt_usd = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0)
          WHERE id = NEW.debit_account_id;
        ELSE
          UPDATE public.accounts SET current_debt_dop = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0)
          WHERE id = NEW.debit_account_id;
        END IF;
      ELSE
        UPDATE public.accounts
        SET balance = GREATEST(v_balance, 0)
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
        IF v_account.currency = 'USD' THEN
          UPDATE public.accounts SET current_debt_usd = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0)
          WHERE id = NEW.credit_account_id;
        ELSE
          UPDATE public.accounts SET current_debt_dop = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0)
          WHERE id = NEW.credit_account_id;
        END IF;
      ELSE
        UPDATE public.accounts
        SET balance = GREATEST(v_balance, 0)
        WHERE id = NEW.credit_account_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_sync_account_from_ledger ON public.ledger_entries;

-- Create the trigger
CREATE TRIGGER trg_sync_account_from_ledger
  AFTER INSERT ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_account_from_ledger();
`

async function applyTrigger() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`API Error (${response.status}):`, text)
    process.exit(1)
  }

  const result = await response.json()
  console.log("Trigger applied successfully!")
  console.log(JSON.stringify(result, null, 2))
}

applyTrigger().catch(console.error)
