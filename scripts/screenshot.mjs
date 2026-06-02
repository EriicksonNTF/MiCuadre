import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "Sitiosdns@tutamail.com";
const PASSWORD = process.env.TEST_PASSWORD || "@Ma-Er.2720..";
const OUT_DIR = path.resolve("screenshots");

const SUPPORTED_ROUTES = {
  "dashboard": "/",
  "accounts": "/accounts",
  "pay": "/pay",
  "expense": "/expense",
  "history": "/history",
  "goals": "/goals",
  "planning": "/planning",
  "coach-ia": "/coach-ia",
  "notifications": "/notifications",
  "profile": "/profile",
  "settings": "/settings",
  "settings-plan": "/settings/plan",
  "settings-categories": "/settings/categories",
  "settings-security": "/settings/security",
  "onboarding": "/onboarding",
  "login": "/auth/login",
  "signup": "/auth/sign-up",
};

const args = process.argv.slice(2);
const targetRoute = args.find(a => a.startsWith("--route="))?.split("=")[1];
const viewport = args.includes("--mobile") ? { width: 430, height: 932 } : { width: 1440, height: 900 };
const fullPage = args.includes("--fullpage");
const takeAll = args.includes("--all") || args.includes("--all-protected");

const needsAuth = (route) => {
  const publicRoutes = ["/auth/login", "/auth/sign-up", "/auth/forgot-password"];
  return !publicRoutes.some(p => route.startsWith(p));
};

async function login(page) {
  console.log(`Logging in as ${EMAIL}...`);
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log("Login OK");
}

async function takeScreenshot(page, routeName, routePath) {
  const filename = `${routeName}.png`;
  const filepath = path.join(OUT_DIR, filename);
  console.log(`Capturing ${routePath} -> ${filepath}`);
  await page.goto(`${BASE_URL}${routePath}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: filepath, fullPage });
  return filepath;
}

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
const page = await context.newPage();

page.on("pageerror", (err) => console.error(`[PAGE ERROR] ${err.message}`));

let captured = [];

if (takeAll) {
  await login(page);
  for (const [name, routePath] of Object.entries(SUPPORTED_ROUTES)) {
    try {
      if (needsAuth(routePath)) {
        const fp = await takeScreenshot(page, name, routePath);
        captured.push(fp);
      }
    } catch (err) {
      console.error(`Failed ${name}: ${err.message}`);
    }
  }
} else if (targetRoute) {
  const routePath = SUPPORTED_ROUTES[targetRoute];
  if (!routePath) {
    console.error(`Unknown route: "${targetRoute}". Supported: ${Object.keys(SUPPORTED_ROUTES).join(", ")}`);
    process.exit(1);
  }
  if (needsAuth(routePath)) {
    await login(page);
  }
  const fp = await takeScreenshot(page, targetRoute, routePath);
  captured.push(fp);
} else {
  console.error("Use: --route=<name>, --all, or --all-protected");
  console.error(`Routes: ${Object.keys(SUPPORTED_ROUTES).join(", ")}`);
  console.error("Options: --mobile, --fullpage");
  process.exit(1);
}

await browser.close();

console.log(`\nDone. ${captured.length} screenshot(s) in ${OUT_DIR}:`);
for (const f of captured) {
  console.log(`  ${f}`);
}
