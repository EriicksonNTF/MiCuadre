import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

// Custom env loader
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) {
    console.log(".env.local not found, trying .env")
    return
  }
  const content = fs.readFileSync(envPath, "utf-8")
  content.split("\n").forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) return
    const index = trimmed.indexOf("=")
    if (index === -1) return
    const key = trimmed.substring(0, index).trim()
    let value = trimmed.substring(index + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1)
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1)
    }
    process.env[key] = value
  })
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function run() {
  const email = `test_user_${Date.now()}@micuadre.app`
  const password = "Password123!"
  const firstName = "TestUser"

  console.log(`Generated test user: ${email}`)

  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on("console", (msg) => {
    console.log(`[Browser Console] [${msg.type()}]:`, msg.text())
  })

  page.on("pageerror", (err) => {
    console.error("[Browser Page Error]:", err.message)
  })

  console.log("Navigating to sign up page...")
  await page.goto("http://localhost:3000/auth/sign-up", { timeout: 60000, waitUntil: "load" })
  await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/signup-1.png" })

  console.log("Filling in sign up form...")
  await page.waitForSelector("#firstName", { timeout: 20000 })
  await page.fill("#firstName", firstName)
  await page.fill("#email", email)
  await page.fill("#password", password)
  await page.fill("#repeat-password", password)
  await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/signup-2.png" })

  console.log("Submitting form...")
  await page.click("button:has-text('Crear Cuenta')")

  // Wait for network/navigation
  console.log("Waiting after submit...")
  try {
    await page.waitForURL((url) => {
      const p = url.pathname
      return p.includes("/onboarding") || p.includes("/verify-email") || p.includes("/sign-up-success")
    }, { timeout: 25000 })
  } catch (e) {
    console.log("Redirection wait timeout:", e.message)
  }
  await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/signup-after.png" })

  console.log("Current URL:", page.url())
  
  const errorMsg = await page.$("p.text-destructive")
  if (errorMsg) {
    const text = await errorMsg.textContent()
    console.error("Sign up error displayed on page:", text)
  }

  // If redirected to verify-email, we will bypass it in DB
  if (page.url().includes("/verify-email") || page.url().includes("/auth/sign-up-success")) {
    console.log("User is at verify-email or sign-up-success, auto-confirming in Supabase auth.users...")
    if (supabaseServiceKey) {
      console.log("Using service role key to confirm user email...")
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: usersData, error: listError } = await adminSupabase.auth.admin.listUsers()
      if (listError) console.error("List users error:", listError)
      const user = usersData?.users?.find(u => u.email === email)
      if (user) {
        const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
          email_confirm: true
        })
        if (updateError) console.error("Update user error:", updateError)
        else console.log("Confirmed email via admin API!")
      } else {
        console.warn("User not found in admin list!")
      }
    } else {
      console.log("No service role key found in env.")
    }
    
    console.log("Navigating to onboarding...")
    await page.goto("http://localhost:3000/onboarding")
    await page.waitForTimeout(4000)
    console.log("URL after navigation:", page.url())
    await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/onboarding-1.png" })
  }

  // Verify onboarding steps
  console.log("Starting onboarding steps check...")
  for (let i = 1; i <= 3; i++) {
    console.log(`Onboarding step ${i}: checking page...`)
    await page.screenshot({ path: `/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/onboarding-step-${i}.png` })
    
    // Click "Continuar" or "Ver mi primer plan"
    try {
      const selector = "button:has-text('Continuar'), button:has-text('Ver mi primer plan')"
      await page.waitForSelector(selector, { timeout: 6000 })
      const nextButton = await page.$(selector)
      if (nextButton) {
        console.log(`Clicking next button for step ${i}...`)
        await nextButton.click()
        await page.waitForTimeout(2000)
      } else {
        console.warn(`No next button found at step ${i}!`)
        break
      }
    } catch (e) {
      console.warn(`Selector timeout or error at step ${i}:`, e.message)
      await page.screenshot({ path: `/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/onboarding-step-${i}-error.png` })
      break
    }
  }

  console.log("Onboarding plan selection screen reached, URL:", page.url())
  await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/onboarding-plan-selection.png" })

  // Let's test the "Saltar y comenzar gratis por ahora" button
  console.log("Clicking 'Saltar y comenzar gratis por ahora'...")
  try {
    const skipSelector = "button:has-text('Saltar y comenzar gratis por ahora'), button:text-is('Saltar')"
    await page.waitForSelector(skipSelector, { timeout: 4000 })
    const skipButton = await page.$(skipSelector)
    if (skipButton) {
      await skipButton.click()
      console.log("Waiting for dashboard redirect...")
      await page.waitForTimeout(5000)
      console.log("URL after skip:", page.url())
      await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/onboarding-after-skip.png" })
    } else {
      console.warn("No skip button found!")
    }
  } catch (e) {
    console.error("Error clicking skip button:", e.message)
    await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/onboarding-skip-error.png" })
  }

  await browser.close()
  console.log("Done!")
}

run().catch(console.error)
