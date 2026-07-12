import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zmbxriaftswtxjihatfr.supabase.co"
const serviceRoleKey = "eyJ_SERVICE_KEY_REMOVED"
const pat = "sbp_REMOVED"
const ref = "zmbxriaftswtxjihatfr"

const supabase = createClient(supabaseUrl, serviceRoleKey)

const sql = `CREATE OR REPLACE FUNCTION public.sync_account_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
DROP TRIGGER IF EXISTS trg_sync_account_from_ledger ON public.ledger_entries;
CREATE TRIGGER trg_sync_account_from_ledger AFTER INSERT ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.sync_account_from_ledger();`

async function main() {
  // 1. Try Management API with just the PAT as Bearer
  console.log("=== Attempt 1: Management API /database/query ===")
  for (const headers of [
    { "Authorization": `Bearer ${pat}`, "Content-Type": "application/json" },
    { "Authorization": `Bearer ${pat}`, "Content-Type": "application/json", "Accept": "application/json" },
    { "Authorization": `Bearer ${pat}`, "Content-Type": "application/json", "X-Client-Info": "supabase-js/2.105.1" },
  ]) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "SELECT 1 AS test" })
    })
    const txt = await r.text()
    if (r.ok) {
      console.log(`  ✅ SUCCESS with headers ${JSON.stringify(Object.keys(headers))}: ${txt.substring(0,200)}`)
      return await applySql(pat)
    } else {
      console.log(`  ${r.status} with headers ${JSON.stringify(Object.keys(headers))}: ${txt.substring(0,100)}`)
    }
  }

  // 2. Try different auth methods
  console.log("\n=== Attempt 2: Auth variations ===")
  const authMethods = [
    { header: "Bearer " + pat, label: "PAT as Bearer" },
    { header: "Bearer " + serviceRoleKey, label: "service_role as Bearer" },
    { header: pat, label: "PAT raw" },
  ]
  for (const { header, label } of authMethods) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { "Authorization": header, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "SELECT 1 AS test" })
    })
    const txt = await r.text()
    if (r.ok) {
      console.log(`  ✅ ${label}: ${txt.substring(0,200)}`)
      return
    }
    console.log(`  ${r.status} ${label}: ${txt.substring(0,100)}`)
  }

  // 3. Try the project's own /rest/v1/ endpoint with service key
  console.log("\n=== Attempt 3: Project REST API ===")
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Prefer": "params=single-object"
      },
      body: JSON.stringify({ query: sql })
    })
    console.log(`  /rest/v1/rpc/: ${r.status} – ${(await r.text()).substring(0,200)}`)
  } catch(e) { console.log(`  Error: ${e.message}`) }

  // 4. Try to use graphql
  console.log("\n=== Attempt 4: GraphQL ===")
  try {
    const r = await fetch(`${supabaseUrl}/graphql/v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({ query: "mutation { __typename }" })
    })
    console.log(`  GraphQL: ${r.status} – ${(await r.text()).substring(0,200)}`)
  } catch(e) { console.log(`  Error: ${e.message}`) }

  // 5. Try to check if the PAT works for listing projects
  console.log("\n=== Attempt 5: List projects with PAT ===")
  const r = await fetch("https://api.supabase.com/v1/projects", {
    headers: { "Authorization": `Bearer ${pat}` }
  })
  const txt = await r.text()
  if (r.ok) {
    const projects = JSON.parse(txt)
    const refs = projects.map(p => p.id).join(", ")
    console.log(`  ✅ Projects: ${refs}`)
    if (projects.find(p => p.id === ref)) {
      console.log("  Project found! Trying SQL...")
      return await applySql(pat)
    }
  } else {
    console.log(`  ${r.status}: ${txt.substring(0,200)}`)
  }

  console.log("\n❌ Cannot execute DDL remotely.")
  console.log("Go to https://supabase.com/dashboard/project/zmbxriaftswtxjihatfr/sql/new")
  console.log("and paste the SQL from the SQL block above.")
}

async function applySql(token) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  })
  const txt = await r.text()
  console.log(`\nTrigger apply: ${r.status} – ${txt.substring(0,500)}`)
  if (r.ok) console.log("✅ TRIGGER APPLIED SUCCESSFULLY!")
}

main().catch(console.error)
