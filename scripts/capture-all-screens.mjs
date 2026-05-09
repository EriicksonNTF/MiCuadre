import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://micuadre-five.vercel.app";
const email = "Sitiosdns@tutamail.com";
const password = "@Ma-Er.2720..";
const outDir = path.resolve("screenshots/app-pages");

const protectedRoutes = [
  { name: "home", url: "/" },
  { name: "accounts", url: "/accounts" },
  { name: "history", url: "/history" },
  { name: "goals", url: "/goals" },
  { name: "notifications", url: "/notifications" },
  { name: "expense", url: "/expense" },
  { name: "pay", url: "/pay" },
  { name: "send", url: "/send" },
  { name: "scan", url: "/scan" },
  { name: "profile", url: "/profile" },
  { name: "settings", url: "/settings" },
  { name: "settings-help", url: "/settings/help" },
  { name: "settings-about", url: "/settings/about" },
  { name: "settings-security", url: "/settings/security" },
  { name: "onboarding", url: "/onboarding" }
];

const publicRoutes = [
  { name: "auth-login", url: "/auth/login" },
  { name: "auth-sign-up", url: "/auth/sign-up" },
  { name: "auth-forgot-password", url: "/auth/forgot-password" },
  { name: "auth-error", url: "/auth/error" },
  { name: "auth-sign-up-success", url: "/auth/sign-up-success" },
  { name: "login", url: "/login" },
  { name: "register", url: "/register" },
  { name: "forgot-password", url: "/forgot-password" },
  { name: "reset-password", url: "/reset-password" },
  { name: "verify-email", url: "/verify-email" }
];

await fs.mkdir(outDir, { recursive: true });

async function captureRoutes(page, routes, prefix) {
  for (const route of routes) {
    try {
      await page.goto(`${baseUrl}${route.url}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(outDir, `${prefix}-${route.name}.png`),
        fullPage: true,
      });
    } catch (error) {
      console.error(`Failed: ${route.url} -> ${error.message}`);
    }
  }
}

const browser = await chromium.launch({ headless: true });

const authContext = await browser.newContext({ viewport: { width: 430, height: 932 } });
const authPage = await authContext.newPage();
await authPage.goto(`${baseUrl}/auth/login`, { waitUntil: "networkidle", timeout: 120000 });
await authPage.fill('input[type="email"]', email);
await authPage.fill('input[type="password"]', password);
await authPage.click('button[type="submit"]');
await authPage.waitForLoadState("networkidle", { timeout: 120000 });
await authPage.waitForTimeout(3000);

await captureRoutes(authPage, protectedRoutes, "protected");

const publicContext = await browser.newContext({ viewport: { width: 430, height: 932 } });
const publicPage = await publicContext.newPage();
await captureRoutes(publicPage, publicRoutes, "public");

await browser.close();
console.log(`Done. Screenshots saved in ${outDir}`);
