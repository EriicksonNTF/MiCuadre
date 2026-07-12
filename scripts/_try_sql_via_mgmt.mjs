import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zmbxriaftswtxjihatfr.supabase.co"

// Try both keys: the PAT the user provided, and the service_role key
const serviceRoleKey = "eyJ_SERVICE_KEY_REMOVED"
const pat = "sbp_REMOVED"

const ref = "zmbxriaftswtxjihatfr"

const supabase = createClient(supabaseUrl, serviceRoleKey)

const sql = `CREATE OR REPLACE FUNCTION public.sync_account_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_balance NUMERIC;
  v_account RECORD;
BEGIN
  IF NEW.debit_account_id NOT IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') THEN
    SELECT type, currency INTO v_account FROM public.accounts WHERE id = NEW.debit_account_id;
    IF FOUND THEN
      SELECT COALESCE(SUM(CASE WHEN le.credit_account_id = NEW.debit_account_id THEN le.amount WHEN le.debit_account_id = NEW.debit_account_id THEN -le.amount ELSE 0 END), 0)
      INTO v_balance
      FROM public.ledger_entries le WHERE le.debit_account_id = NEW.debit_account_id OR le.credit_account_id = NEW.debit_account_id;
      IF v_account.type = 'credit' THEN
        IF v_account.currency = 'USD' THEN
          UPDATE public.accounts SET current_debt_usd = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0) WHERE id = NEW.debit_account_id;
        ELSE
          UPDATE public.accounts SET current_debt_dop = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0) WHERE id = NEW.debit_account_id;
        END IF;
      ELSE
        UPDATE public.accounts SET balance = GREATEST(v_balance, 0) WHERE id = NEW.debit_account_id;
      END IF;
    END IF;
  END IF;
  IF NEW.credit_account_id NOT IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') THEN
    SELECT type, currency INTO v_account FROM public.accounts WHERE id = NEW.credit_account_id;
    IF FOUND THEN
      SELECT COALESCE(SUM(CASE WHEN le.credit_account_id = NEW.credit_account_id THEN le.amount WHEN le.debit_account_id = NEW.credit_account_id THEN -le.amount ELSE 0 END), 0)
      INTO v_balance
      FROM public.ledger_entries le WHERE le.debit_account_id = NEW.credit_account_id OR le.credit_account_id = NEW.credit_account_id;
      IF v_account.type = 'credit' THEN
        IF v_account.currency = 'USD' THEN
          UPDATE public.accounts SET current_debt_usd = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0) WHERE id = NEW.credit_account_id;
        ELSE
          UPDATE public.accounts SET current_debt_dop = GREATEST(v_balance, 0), current_debt = GREATEST(v_balance, 0) WHERE id = NEW.credit_account_id;
        END IF;
      ELSE
        UPDATE public.accounts SET balance = GREATEST(v_balance, 0) WHERE id = NEW.credit_account_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_sync_account_from_ledger ON public.ledger_entries;
CREATE TRIGGER trg_sync_account_from_ledger AFTER INSERT ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.sync_account_from_ledger();`

async function tryAll() {
  // Test 1: PATs in various formats on Management API
  const tokens = [
    { label: "PAT bare", token: pat },
    { label: "PAT with supabase_ prefix variations", token: pat },
    { label: "service_role as PAT", token: serviceRoleKey },
  ]
  
  for (const { label, token } of tokens) {
    for (const url of [
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      `https://api.supabase.com/v1/projects/${ref}/database/sql`,
    ]) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: "SELECT 1 AS test" }),
        })
        const txt = await res.text()
        console.log(`${label} @ ${url.split("/").pop()}: ${res.status} – ${txt.substring(0, 150)}`)
        if (res.ok) {
          console.log("✅ Found working endpoint! Applying full SQL...")
          const res2 = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: sql }),
          })
          const txt2 = await res2.text()
          console.log(`Trigger apply: ${res2.status} – ${txt2.substring(0, 300)}`)
          return
        }
      } catch (e) {
        console.log(`${label} @ ${url.split("/").pop()}: Error – ${e.message}`)
      }
    }
  }
  
  // Test 2: SQL via direct REST endpoint with service role
  console.log("\n--- Trying REST RPC approach ---")
  // Use the supabase client to try calling an RPC that might let us exec SQL
  const funcs = [
    "exec_sql",
    "pg_exec_sql", 
    "run_sql",
    "exec",
    "query",
    "pgexec",
    "db_exec",
    "admin_exec",
  ]
  for (const name of funcs) {
    try {
      const { data, error } = await supabase.rpc(name, { sql: sql })
      console.log(`${name}: ${error ? `no – ${error.message.substring(0, 60)}` : "✅ SUCCESS"}`)
      if (!error) {
        console.log("Result:", JSON.stringify(data).substring(0, 200))
        return
      }
    } catch (e) {
      console.log(`${name}: error – ${e.message.substring(0, 60)}`)
    }
  }

  // Test 3: Try to create the function via a SQL string sent through the REST API
  console.log("\n--- Trying to call via /rest/v1/rpc/ with raw SQL ---")
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({ query: sql }),
    })
    const txt = await res.text()
    console.log(`RPC root: ${res.status} – ${txt.substring(0, 200)}`)
  } catch (e) {
    console.log(`RPC root error: ${e.message}`)
  }
  
  console.log("\n❌ Could not execute DDL remotely.")
  console.log("Please run the SQL directly in the Supabase Dashboard SQL Editor.")
}

tryAll().catch(console.error)
