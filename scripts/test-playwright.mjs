import { chromium } from "playwright"

async function run() {
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on("console", (msg) => {
    console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text())
  })

  page.on("pageerror", (err) => {
    console.error("BROWSER PAGE ERROR:", err.message)
  })

  console.log("Navigating to login...")
  await page.goto("http://localhost:3000/auth/login")

  console.log("Taking screenshot of login...")
  await page.screenshot({ path: "/Users/papolo/.gemini/antigravity/brain/2eca2907-6e2f-4bdf-a77f-7e9231a32f47/scratch/login.png" })

  await browser.close()
  console.log("Done!")
}

run().catch(console.error)
