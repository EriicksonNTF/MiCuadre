import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zmbxriaftswtxjihatfr.supabase.co"
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYnhyaWFmdHN3dHhqaWhhdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MjM2NiwiZXhwIjoyMDkzMDM4MzY2fQ.-Jobz4FSZXWY3rCHLBsiZnNQVyCTBUvMa_wgYeBa9Ek"

const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
  // 1. Check which SQL functions exist and their definitions
  const { data: funcs, error: funcsErr } = await supabase
    .from("pg_proc")
    .select("proname, prosrc")
    .in("proname", ["ledger_calc_balance", "sync_account_from_ledger", "reconcile_account_balance"])
    .order("proname", { ascending: true })

  if (funcsErr) {
    console.log("Could not query pg_proc directly (expected):", funcsErr.message)
    console.log("\nTrying via custom query function...")
  } else {
    console.log("=== DEPLOYED FUNCTIONS ===")
    for (const f of funcs) {
      console.log(`\n--- ${f.proname} ---`)
      console.log(f.prosrc)
    }
  }

  // 2. Try to call the actual function to check its behavior
  // First, get a real account
  const { data: accounts, error: acctsErr } = await supabase
    .from("accounts")
    .select("id, user_id, name, type, balance, currency, current_debt_dop, current_debt")
    .limit(5)

  if (acctsErr) {
    console.log("\nError fetching accounts:", acctsErr.message)
  } else {
    console.log("\n=== ACCOUNTS SAMPLE ===")
    for (const a of accounts) {
      console.log(`${a.name} (${a.type}): balance=${a.balance}, current_debt=${a.current_debt}, current_debt_dop=${a.current_debt_dop}`)
      
      // Try calling ledger_calc_balance
      const { data: lb, error: lbErr } = await supabase.rpc("ledger_calc_balance", { p_account_id: a.id })
      if (lbErr) {
        console.log(`  ledger_calc_balance error: ${lbErr.message}`)
      } else {
        console.log(`  ledger_calc_balance result: ${lb}`)
        console.log(`  discrepancy: ${Number(a.balance || 0) - Number(lb || 0)}`)
      }
    }
  }

  // 3. Check for the trigger
  const { data: triggers, error: trigErr } = await supabase
    .from("pg_trigger")
    .select("tgname, tgrelid")
    .eq("tgname", "trg_sync_account_from_ledger")

  if (trigErr) {
    console.log("\nCould not check triggers:", trigErr.message)
  } else {
    console.log("\n=== TRIGGER STATUS ===")
    console.log(triggers.length > 0 ? "TRIGGER IS ACTIVE!" : "No trigger found (not active)")
  }

  // 4. Check recent ledger entries for a specific account to verify direction
  if (accounts && accounts.length > 0) {
    const firstId = accounts[0].id
    const { data: entries, error: entriesErr } = await supabase
      .from("ledger_entries")
      .select("id, debit_account_id, credit_account_id, amount, entry_type, description, created_at")
      .or(`debit_account_id.eq.${firstId},credit_account_id.eq.${firstId}`)
      .order("created_at", { ascending: false })
      .limit(10)

    if (entriesErr) {
      console.log(`\nError fetching ledger entries: ${entriesErr.message}`)
    } else {
      console.log(`\n=== LAST 10 LEDGER ENTRIES for ${accounts[0].name} (${firstId}) ===`)
      for (const e of entries) {
        const isDebit = e.debit_account_id === firstId
        const isCredit = e.credit_account_id === firstId
        const direction = isDebit ? "DEBIT (-)" : isCredit ? "CREDIT (+)" : "N/A"
        console.log(`  ${e.entry_type}: ${e.description || "no desc"} | amount=${e.amount} | ${direction} | debit=${e.debit_account_id?.substring(0,8)}... credit=${e.credit_account_id?.substring(0,8)}...`)
      }
    }
  }
}

main().catch(console.error)
