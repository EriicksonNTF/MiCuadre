// Captures the 4 key screenshots in a SINGLE browser session to avoid re-login.
// Waits for actual content (not loading spinner) before capturing each route.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const OUT_DIR = path.resolve("screenshots");

if (!EMAIL || !PASSWORD) {
  console.error("ERROR: Debes definir TEST_EMAIL y TEST_PASSWORD como variables de entorno.");
  process.exit(1);
}

const ROUTES = [
  { name: "dashboard", path: "/", contentSelector: "section, [class*='balance'], main h2" },
  { name: "accounts", path: "/accounts", contentSelector: "main, [class*='account-card'], article" },
  { name: "expense", path: "/expense", contentSelector: "main, form, [class*='hero-amount'], input" },
  { name: "planning", path: "/planning", contentSelector: "main, [class*='budget'], section" },
];

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14 — middle of the road, shows truncation clearly

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

page.on("pageerror", (err) => console.error(`[PAGE ERROR] ${err.message}`));

// --- LOGIN (multi-step) ---
console.log(`Logging in as ${EMAIL}...`);
await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

let emailInput = await page.$('input[type="email"]');
if (!emailInput) {
  console.log("Auth choice screen — clicking 'Iniciar sesión'…");
  await page.locator('button', { hasText: 'Iniciar sesión' }).first().click();
  await page.waitForTimeout(1500);
  emailInput = await page.$('input[type="email"]');
}
if (!emailInput) throw new Error("Email input not found after choice click");

await emailInput.fill(EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30000 });
await page.waitForTimeout(2500);
console.log("Login OK ->", page.url());

// --- CAPTURE EACH ROUTE (reuse session) ---
for (const { name, path: routePath, contentSelector } of ROUTES) {
  const filepath = path.join(OUT_DIR, `${name}.png`);
  console.log(`Capturing ${routePath} -> ${filepath}`);
  try {
    await page.goto(`${BASE_URL}${routePath}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Wait for real content (not loading spinner). 8s should be plenty for SWR fetches.
    try {
      await page.waitForSelector(contentSelector, { timeout: 8000 });
    } catch {
      console.log(`  [warn] content selector "${contentSelector}" not found in 8s, capturing anyway`);
    }
    // Extra settle for fonts/data
    await page.waitForTimeout(2500);
    await page.screenshot({ path: filepath });
    console.log(`  [ok] ${name} captured`);
  } catch (err) {
    console.error(`  [fail] ${name}: ${err.message}`);
  }
}

// Also grab a close-up of the navbar region on the dashboard for the truncation analysis
try {
  const nav = await page.$("nav");
  if (nav) {
    // Navigate back to dashboard first to be sure
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const navEl = await page.$("nav");
    if (navEl) {
      await navEl.screenshot({ path: path.join(OUT_DIR, "_navbar-closeup.png") });
      console.log("[ok] navbar closeup captured");
    }
  }
} catch (err) {
  console.error("[warn] navbar closeup failed:", err.message);
}

await browser.close();
console.log("\nDone.");
