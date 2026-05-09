import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://micuadre-five.vercel.app";
const email = "Sitiosdns@tutamail.com";
const password = "@Ma-Er.2720..";
const outDir = path.resolve("compositions/assets/app-shots");

const routes = [
  { name: "dashboard", url: "/" },
  { name: "accounts", url: "/accounts" },
  { name: "history", url: "/history" },
  { name: "goals", url: "/goals" },
  { name: "notifications", url: "/notifications" },
  { name: "pay", url: "/pay" }
];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
const page = await context.newPage();

await page.goto(`${baseUrl}/auth/login`, { waitUntil: "networkidle", timeout: 120000 });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);

await Promise.all([
  page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 120000 }),
  page.click('button[type="submit"]')
]);

await page.waitForTimeout(2500);

for (const route of routes) {
  await page.goto(`${baseUrl}${route.url}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, `${route.name}.png`), fullPage: true });
}

await browser.close();
console.log(`Screenshots saved to ${outDir}`);
