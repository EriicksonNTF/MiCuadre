import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zmbxriaftswtxjihatfr.supabase.co"
const serviceKey = "eyJ_SERVICE_KEY_REMOVED"

const supabase = createClient(supabaseUrl, serviceKey)

async function tryApplyViaApi() {
  // Try using the Supabase Management API v1 with correct auth
  const PAT = "sbp_REMOVED"
  const ref = "zmbxriaftswtxjihatfr"

  const sql = `
CREATE OR REPLACE FUNCTION public.sync_account_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_balance NUMERIC;
  v_account RECORD;
BEGIN
  -- Handle debit_account_id
  IF NEW.debit_account_id NOT IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) THEN
    SELECT type, currency INTO v_account
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
        UPDATE public.accounts SET balance = GREATEST(v_balance, 0)
        WHERE id = NEW.debit_account_id;
      END IF;
    END IF;
  END IF;

  -- Handle credit_account_id
  IF NEW.credit_account_id NOT IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) THEN
    SELECT type, currency INTO v_account
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
        UPDATE public.accounts SET balance = GREATEST(v_balance, 0)
        WHERE id = NEW.credit_account_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_account_from_ledger ON public.ledger_entries;
CREATE TRIGGER trg_sync_account_from_ledger
  AFTER INSERT ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_account_from_ledger();
`

  // Try multiple API endpoints
  const endpoints = [
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    `https://api.supabase.com/v1/projects/${ref}/database/sql`,
    `https://${ref}.supabase.co/rest/v1/rpc/pg_exec_sql`,
  ]

  for (const url of endpoints) {
    try {
      console.log(`Trying ${url}...`)
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PAT}`,
          "Content-Type": "application/json",
          "apikey": serviceKey,
        },
        body: JSON.stringify({ query: sql }),
      })

      if (response.ok) {
        const text = await response.text()
        console.log(`✅ SUCCESS! Response:`, text.substring(0, 500))
        return
      } else {
        const text = await response.text()
        console.log(`  Status ${response.status}: ${text.substring(0, 200)}`)
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`)
    }
  }

  console.log(`\n❌ All endpoints failed.`)
  console.log(`\nTo apply the trigger manually, run this SQL in the Supabase Dashboard SQL Editor:`)
  console.log(sql)
}

tryApplyViaApi().catch(console.error)
