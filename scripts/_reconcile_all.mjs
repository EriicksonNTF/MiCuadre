import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zmbxriaftswtxjihatfr.supabase.co"
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYnhyaWFmdHN3dHhqaWhhdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MjM2NiwiZXhwIjoyMDkzMDM4MzY2fQ.-Jobz4FSZXWY3rCHLBsiZnNQVyCTBUvMa_wgYeBa9Ek"

const supabase = createClient(supabaseUrl, serviceKey)

async function reconcileAll() {
  const { data: accounts, error: acctsErr } = await supabase
    .from("accounts")
    .select("id, user_id, name, type, balance, current_debt_dop, current_debt_usd, current_debt, currency")

  if (acctsErr) {
    console.error("Failed to fetch accounts:", acctsErr.message)
    process.exit(1)
  }

  console.log(`Found ${accounts.length} accounts. Reconciling...\n`)

  let corrected = 0
  let errors = 0

  for (const account of accounts) {
    const { data: ledgerBalance, error: lbErr } = await supabase
      .rpc("ledger_calc_balance", { p_account_id: account.id })

    if (lbErr) {
      console.error(`  ERROR: ledger_calc_balance for ${account.name} (${account.id}): ${lbErr.message}`)
      errors++
      continue
    }

    const ledgerSum = Math.max(0, Number(ledgerBalance || 0))
    let updateFields = {}

    if (account.type === "credit") {
      const storedDop = Number(account.current_debt_dop ?? account.current_debt ?? 0)
      const dopDiff = Math.abs(ledgerSum - storedDop)

      if (dopDiff > 0.01) {
        updateFields = {
          current_debt_dop: ledgerSum,
          current_debt: ledgerSum,
        }
      }
    } else {
      const storedBalance = Number(account.balance ?? 0)
      const diff = Math.abs(ledgerSum - storedBalance)

      if (diff > 0.01) {
        updateFields = { balance: ledgerSum }
      }
    }

    const hasDiff = Object.keys(updateFields).length > 0

    if (hasDiff) {
      const { error: upErr } = await supabase
        .from("accounts")
        .update(updateFields)
        .eq("id", account.id)

      if (upErr) {
        console.error(`  ERROR updating ${account.name}: ${upErr.message}`)
        errors++
      } else {
        corrected++
        const oldVal = account.type === "credit"
          ? Number(account.current_debt_dop ?? account.current_debt ?? 0)
          : Number(account.balance ?? 0)
        console.log(`  ✅ ${account.name} (${account.type}): ${oldVal} → ${ledgerSum}`)
      }
    } else {
      const displayVal = account.type === "credit"
        ? Number(account.current_debt_dop ?? account.current_debt ?? 0)
        : Number(account.balance ?? 0)
      console.log(`  ✓ ${account.name} (${account.type}): OK (${displayVal})`)
    }
  }

  console.log(`\n=== Done: ${corrected} corrected, ${errors} errors, ${accounts.length - corrected - errors} already correct ===`)
}

reconcileAll().catch(console.error)
