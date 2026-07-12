import { createClient } from "@supabase/supabase-js"

const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYnhyaWFmdHN3dHhqaWhhdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MjM2NiwiZXhwIjoyMDkzMDM4MzY2fQ.-Jobz4FSZXWY3rCHLBsiZnNQVyCTBUvMa_wgYeBa9Ek"
const supabase = createClient("https://zmbxriaftswtxjihatfr.supabase.co", serviceRoleKey)

async function main() {
  // 1. Check function exists
  console.log("=== Verifying function and trigger ===")
  
  // Get a debit account to test with
  const { data: accounts } = await supabase.from("accounts").select("id, name, type, balance").limit(5)
  console.log("Accounts before test:")
  for (const a of accounts) {
    console.log(`  ${a.name} (${a.type}): balance=${a.balance}`)
  }

  // Check ledger_entries count
  const { count } = await supabase.from("ledger_entries").select("*", { count: "exact", head: true })
  console.log(`\nTotal ledger_entries: ${count}`)

  // Try to test the trigger by creating a dummy ledger entry and checking
  // First get a real debit account
  const debitAcct = accounts.find(a => a.type === "debit")
  if (debitAcct) {
    console.log(`\n=== Testing trigger with ${debitAcct.name} ===`)
    const oldBalance = debitAcct.balance
    
    // Create a test expense (debit: account, credit: income/expense sentinel)
    const { data: entry, error: entryErr } = await supabase
      .from("ledger_entries")
      .insert({
        debit_account_id: debitAcct.id,
        credit_account_id: "00000000-0000-0000-0000-000000000002",
        amount: 100,
        currency: "DOP",
        description: "TEST - delete me",
      })
      .select()
      .single()
    
    if (entryErr) {
      console.log(`  Insert error: ${entryErr.message}`)
    } else {
      console.log(`  Created entry: ${entry.id}`)
      
      // Check if balance was updated by the trigger
      const { data: updated } = await supabase
        .from("accounts")
        .select("balance")
        .eq("id", debitAcct.id)
        .single()
      
      if (updated) {
        const expected = oldBalance - 100
        console.log(`  Old balance: ${oldBalance}`)
        console.log(`  New balance: ${updated.balance}`)
        console.log(`  Expected: ${expected}`)
        console.log(`  Trigger working: ${updated.balance === expected ? "✅ YES" : "❌ NO"}`)
      }
      
      // Clean up test data
      await supabase.from("ledger_entries").delete().eq("id", entry.id)
      await supabase.from("accounts").update({ balance: oldBalance }).eq("id", debitAcct.id)
      console.log("  Test cleanup done")
    }
  }

  console.log("\n=== Verification complete ===")
}

main().catch(console.error)
