import { createClient } from "@supabase/supabase-js"

const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYnhyaWFmdHN3dHhqaWhhdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MjM2NiwiZXhwIjoyMDkzMDM4MzY2fQ.-Jobz4FSZXWY3rCHLBsiZnNQVyCTBUvMa_wgYeBa9Ek"
const supabase = createClient("https://zmbxriaftswtxjihatfr.supabase.co", serviceRoleKey)

async function main() {
  // Get a user and their debit account
  const { data: profiles } = await supabase.from("profiles").select("id").limit(1)
  if (!profiles || profiles.length === 0) { console.log("No profiles found"); return }
  const userId = profiles[0].id
  console.log(`Using user: ${userId}`)

  const { data: accounts } = await supabase.from("accounts")
    .select("id, name, type, balance, user_id")
    .eq("user_id", userId)
    .eq("type", "debit")
    .limit(1)
  if (!accounts || accounts.length === 0) { console.log("No debit accounts for this user"); return }
  const acct = accounts[0]
  console.log(`Account: ${acct.name} (${acct.id}) balance=${acct.balance}`)

  const oldBalance = acct.balance

  // Create test ledger entry
  const { data: entry, error: entryErr } = await supabase
    .from("ledger_entries")
    .insert({
      debit_account_id: acct.id,
      credit_account_id: "00000000-0000-0000-0000-000000000002",
      amount: 100,
      currency: "DOP",
      description: "TEST trigger - delete me",
      user_id: userId,
    })
    .select()
    .single()

  if (entryErr) {
    console.log(`Insert error: ${entryErr.message}`)
    return
  }
  console.log(`Created entry: ${entry.id}`)

  // Check if balance was updated
  const { data: updated } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", acct.id)
    .single()

  const expected = oldBalance - 100
  const working = updated && updated.balance === expected
  console.log(`Old balance: ${oldBalance}`)
  console.log(`New balance: ${updated ? updated.balance : "N/A"}`)
  console.log(`Expected: ${expected}`)
  console.log(`Trigger working: ${working ? "✅ YES" : "❌ NO"}`)

  // Cleanup
  await supabase.from("ledger_entries").delete().eq("id", entry.id)
  await supabase.from("accounts").update({ balance: oldBalance }).eq("id", acct.id)
  console.log("Cleanup done")
}

main().catch(console.error)
