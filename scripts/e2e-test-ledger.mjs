import { chromium } from "playwright"
import { execSync } from "child_process"
import { writeFileSync, unlinkSync } from "node:fs"
import { randomUUID } from "node:crypto"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const EMAIL = "example@example.com"
const PASSWORD = "1234567890"

function sqlQuery(sql) {
  const id = randomUUID()
  const tmpFile = `/tmp/mc_sql_${id}.json`
  writeFileSync(tmpFile, JSON.stringify({ query: sql }))
  try {
    const result = execSync(`curl -s --max-time 15 -X POST \
      "https://api.supabase.com/v1/projects/zmbxriaftswtxjihatfr/database/query" \
      -H "Authorization: Bearer ${process.env.SUPABASE_MGMT_TOKEN || ''}" \
      -H "Content-Type: application/json" \
      -d @${tmpFile}`, { encoding: "utf8", timeout: 20000 })
    return JSON.parse(result)
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  const results = { login: false, dashboard: false, ledgerWrite: false, consistency: false, errors: [] }

  // 1. LOGIN
  console.log("\n[1/4] 🔐 Iniciando sesión...")
  try {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "load", timeout: 30000 })
    await sleep(2000)
    await page.locator('button:has-text("Iniciar sesión")').first().click()
    await sleep(1500)
    await page.locator('input[name="email"]').fill(EMAIL)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 30000 })
    await sleep(2000)
    await page.screenshot({ path: "screenshots/test-01-login.png", fullPage: false })
    results.login = true
    console.log("  ✅")
  } catch (e) {
    console.log("  ❌", e.message.slice(0, 100))
    results.errors.push("login: " + e.message.slice(0, 100))
  }

  // 2. DASHBOARD
  console.log("\n[2/4] 📊 Dashboard...")
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "load", timeout: 30000 })
    await sleep(3000)
    await page.screenshot({ path: "screenshots/test-02-dashboard.png", fullPage: true })
    const text = await page.textContent("body")
    results.dashboard = text && text.length > 200
    console.log(`  ${results.dashboard ? "✅" : "⚠️ vacío"} (${text?.length || 0} chars)`)
  } catch (e) {
    console.log("  ❌", e.message.slice(0, 100))
    results.errors.push("dashboard: " + e.message.slice(0, 100))
  }

  // 3. DIRECT LEDGER WRITE
  console.log("\n[3/4] 🔬 Ledger write...")
  try {
    const countBefore = sqlQuery("SELECT COUNT(*) AS c FROM ledger_entries")[0]?.c || 0
    console.log(`  Entries totales: ${countBefore}`)

    const testUuid = randomUUID()
    const insertResult = sqlQuery(`INSERT INTO ledger_entries (id, user_id, debit_account_id, credit_account_id, amount, currency, entry_type, description) 
      VALUES ('${testUuid}', 'c762ae1e-f63b-4f8e-a7f4-4af87b359fe3', 
              '6596c419-46a6-4930-9732-8dda7b5fd2ed', 
              '00000000-0000-0000-0000-000000000002', 
              500, 'DOP', 'expense', 'E2E test entry')`)
    console.log(`  Insert result: ${JSON.stringify(insertResult)}`)

    const verify = sqlQuery(`SELECT amount, description FROM ledger_entries WHERE id = '${testUuid}'`)
    console.log(`  Verify result: ${JSON.stringify(verify)}`)

    if (verify && verify.length > 0) {
      console.log(`  ✅ Entry: $${verify[0].amount} — ${verify[0].description}`)
      sqlQuery(`DELETE FROM ledger_entries WHERE id = '${testUuid}'`)
      console.log("  🧹 Cleaned up")
      results.ledgerWrite = true
    } else {
      console.log("  ⚠️ Entry not found in verify")
    }
  } catch (e) {
    console.log("  ❌", e.message)
    results.errors.push("ledger_write: " + e.message)
  }

  // 4. CONSISTENCY
  console.log("\n[4/4] ✅ Consistencia...")
  try {
    const data = sqlQuery(`SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE CASE WHEN a.type = 'credit' THEN COALESCE(a.current_debt_dop, 0) + COALESCE(a.current_debt_usd, 0) ELSE COALESCE(a.balance, 0) END != COALESCE(ledger_calc_balance(a.id), 0)) AS inc
    FROM accounts a WHERE a.is_active = true`)
    const inc = parseInt(data[0]?.inc || 0)
    results.consistency = inc === 0
    console.log(`  ${data[0]?.total || 0} cuentas, ${inc} inconsistentes ${results.consistency ? "✅" : "⚠️"}`)
  } catch (e) {
    console.log("  ❌", e.message.slice(0, 100))
    results.errors.push("consistency: " + e.message.slice(0, 100))
  }

  // REPORT
  const pass = results.login && results.dashboard && results.ledgerWrite && results.consistency
  console.log("\n" + "=".repeat(45))
  console.log("📊 INFORME FINAL")
  console.log("=".repeat(45))
  console.log(`  🔐 Login:        ${results.login ? "✅" : "❌"}`)
  console.log(`  📊 Dashboard:    ${results.dashboard ? "✅" : "❌"}`)
  console.log(`  🔬 Ledger write: ${results.ledgerWrite ? "✅" : "❌"}`)
  console.log(`  ✅ Consistencia: ${results.consistency ? "✅" : "❌"}`)
  if (results.errors.length) {
    console.log(`  ❌ Errores: ${results.errors.length}`)
    results.errors.forEach(e => console.log("    •", e))
  }
  console.log("=".repeat(45))
  console.log(pass ? "\n✅ TODAS PASARON" : "\n⚠️ ALGUNAS FALLARON")

  await browser.close()
}

run().catch(e => {
  console.error("FATAL:", e.message)
  process.exit(1)
})
