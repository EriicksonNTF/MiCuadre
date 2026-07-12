import { createClient } from "@supabase/supabase-js"

const K = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYnhyaWFmdHN3dHhqaWhhdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MjM2NiwiZXhwIjoyMDkzMDM4MzY2fQ.-Jobz4FSZXWY3rCHLBsiZnNQVyCTBUvMa_wgYeBa9Ek"
const supabase = createClient("https://zmbxriaftswtxjihatfr.supabase.co", K)

async function main() {
  const userId = "84a2549e-5db4-4912-8673-88323cbcba73"

  const { data: accts } = await supabase.from("accounts").select("id,name,type,balance").eq("user_id", userId).eq("type", "debit").limit(1)
  const acct = accts?.[0] || (await supabase.from("accounts").select("id,name,type,balance").eq("user_id", userId).limit(1)).data?.[0]
  if (!acct) { console.log("No accounts"); return }

  console.log(`Using ${acct.name}: balance=${acct.balance}`)
  const old = acct.balance

  const { data: e, error: eErr } = await supabase.from("ledger_entries").insert({
    debit_account_id: acct.id,
    credit_account_id: "00000000-0000-0000-0000-000000000002",
    amount: 100, currency: "DOP",
    description: "TEST trigger - delete me",
    user_id: userId,
    entry_type: "expense",
  }).select().single()
  if (eErr) { console.log(`Insert: ${eErr.message}`); return }
  console.log(`Created ${e.id}`)

  const { data: u } = await supabase.from("accounts").select("balance").eq("id", acct.id).single()
  const expected = old - 100
  console.log(`Balance: ${old} → ${u?.balance} (expected ${expected})`)
  console.log(`Trigger: ${u?.balance === expected ? "✅" : "❌ mismatch"}`)

  await supabase.from("ledger_entries").delete().eq("id", e.id)
  await supabase.from("accounts").update({ balance: old }).eq("id", acct.id)
  console.log("Cleaned up")
}

main().catch(console.error)
