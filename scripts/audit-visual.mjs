import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "https://micuadre-five.vercel.app";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("ERROR: Debes definir TEST_EMAIL y TEST_PASSWORD como variables de entorno.");
  process.exit(1);
}
const AUDIT_DIR = path.resolve("screenshots/audit");
const LOG_DIR = path.resolve("screenshots/audit/logs");

const issues = [];
const consoleLogs = [];
const screenshots = [];

function severity(s) { return s; }

// ---- Helpers ----
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

function slug(text) {
  return text.toLowerCase()
    .replace(/[áéíóú]/g, (c) => "aeiou"["áéíóú".indexOf(c)])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function capture(page, module, severity, routePath, problem) {
  const moduleDir = path.join(AUDIT_DIR, slug(module));
  await ensureDir(moduleDir);
  const filename = `${severity}__${slug(routePath)}__${slug(problem || "captura")}.png`;
  const filepath = path.join(moduleDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  screenshots.push({ module, severity, routePath, problem: problem || "", filepath, filename });
  // also save console logs for this page
  const logfile = filepath.replace(/\.png$/, ".txt");
  await fs.writeFile(logfile, consoleLogs.join("\n"), "utf-8");
  consoleLogs.length = 0;
  return filepath;
}

async function capturePage(page, module, sev, routePath, problem) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    console.warn(`[WARN] ${routePath}: networkidle timeout`);
  }
  return capture(page, module, sev, routePath, problem);
}

async function reportConsole(page) {
  page.on("console", (msg) => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === "error") {
      issues.push({
        severity: "high", module: "runtime", route: page.url(),
        problem: `Console error: ${msg.text()}`, impact: "Posible error de JS",
        cause: "Error en runtime del navegador", recommendation: "Revisar consola"
      });
    }
  });
  page.on("pageerror", (err) => {
    const text = `[PAGE_ERROR] ${err.message}`;
    consoleLogs.push(text);
    issues.push({
      severity: "critical", module: "runtime", route: page.url(),
      problem: `Page error: ${err.message}`, impact: "Aplicación puede no funcionar",
      cause: "Error no capturado en React", recommendation: "Revisar stack trace"
    });
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      const text = `[HTTP ${resp.status()}] ${resp.url()}`;
      consoleLogs.push(text);
    }
  });
}

async function domAnalysis(page, route) {
  const analysis = {};
  try {
    analysis.title = await page.title();
    analysis.hasErrorText = await page.locator("text=error", { ignoreCase: true }).count() > 0;
    analysis.has404 = await page.locator("text=404", { ignoreCase: true }).count() > 0;
    analysis.hasLoading = await page.locator('[class*="loading"], [class*="spinner"]').count() > 0;
    analysis.buttons = await page.locator("button").count();
    analysis.inputs = await page.locator("input, select, textarea").count();
    analysis.url = page.url();
  } catch (e) {
    analysis.error = e.message;
  }
  return analysis;
}

// ---- Audit Runner ----
async function runAudit() {
  await ensureDir(AUDIT_DIR);
  await ensureDir(LOG_DIR);

  console.log("=== MI CUADRE VISUAL QA AUDIT ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Audit dir: ${AUDIT_DIR}`);
  console.log("");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });
  const page = await context.newPage();
  await reportConsole(page);

  // ---- LOGIN ----
  console.log("1. Logging in...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30000 });
  } catch {
    console.warn("Login redirect timeout");
  }
  await page.waitForTimeout(3000);
  console.log(`   Post-login URL: ${page.url()}`);

  // ---- A: ONBOARDING DETECTION ----
  // Check if we're on onboarding or dashboard
  const onOnboarding = page.url().includes("/onboarding");
  if (onOnboarding) {
    console.log("   Onboarding detected, capturing...");
    await capturePage(page, "onboarding", "info", "/onboarding", "onboarding-screen");
    // Try to skip onboarding (click skip if present)
    try {
      const skipBtn = page.locator("button:has-text('Saltar')");
      if (await skipBtn.isVisible({ timeout: 3000 })) {
        await skipBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch { /* skip */ }
  }

  // ---- DASHBOARD ----
  console.log("\n2. Dashboard...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  const d1 = await domAnalysis(page, "/");
  await capturePage(page, "dashboard", "info", "/", "dashboard-principal");
  if (d1.hasErrorText) issues.push({
    severity: "high", module: "dashboard", route: "/",
    problem: "Texto de error visible en dashboard", impact: "Usuario ve error",
    cause: "Posible fallo de carga de datos", recommendation: "Revisar logs de consola"
  });

  // ---- C: ACCOUNTS ----
  console.log("\n3. Accounts...");
  await page.goto(`${BASE_URL}/accounts`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  const accAnalysis = await domAnalysis(page, "/accounts");
  await capturePage(page, "accounts", "info", "/accounts", "lista-cuentas");
  if (accAnalysis.buttons === 0) issues.push({
    severity: "high", module: "accounts", route: "/accounts",
    problem: "No se encontraron botones en accounts", impact: "Usuario no puede interactuar",
    cause: "Posible error de render", recommendation: "Revisar componente accounts"
  });

  // Check for account links and visit first one
  const accountLinks = page.locator('a[href*="/accounts/"]');
  const accountCount = await accountLinks.count();
  if (accountCount > 0) {
    const href = await accountLinks.first().getAttribute("href");
    console.log(`   Visiting account detail: ${href}`);
    await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await capturePage(page, "accounts", "info", href, "detalle-cuenta");
  } else {
    issues.push({
      severity: "medium", module: "accounts", route: "/accounts",
      problem: "No hay cuentas creadas para auditar detalle",
      impact: "No se pudo auditar detalle de cuenta",
      cause: "Faltan datos de prueba", recommendation: "Crear cuentas de prueba"
    });
  }

  // ---- D: PAY ----
  console.log("\n4. Pay...");
  await page.goto(`${BASE_URL}/pay`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "pay", "info", "/pay", "pantalla-pago");

  // Check for pay buttons
  const payBtns = await page.locator("button:has-text('Pagar')").count();
  if (payBtns === 0) {
    issues.push({
      severity: "medium", module: "pay", route: "/pay",
      problem: "No se encontró botón Pagar visible",
      impact: "Usuario no sabe cómo iniciar pago",
      cause: "Diseño del botón o lógica condicional", recommendation: "Verificar visibilidad del botón Pagar"
    });
  }

  // ---- E: EXPENSE / TRANSACTIONS ----
  console.log("\n5. Transactions (expense)...");
  await page.goto(`${BASE_URL}/expense`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "transactions", "info", "/expense", "agregar-transaccion");
  const expForm = await domAnalysis(page, "/expense");
  if (expForm.inputs < 3) issues.push({
    severity: "high", module: "transactions", route: "/expense",
    problem: `Formulario de gasto con pocos campos (${expForm.inputs})`,
    impact: "Usuario no puede completar transacción", cause: "Formulario incompleto o no cargado",
    recommendation: "Verificar render del formulario"
  });

  // History
  console.log("   Transaction history...");
  await page.goto(`${BASE_URL}/history`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "transactions", "info", "/history", "historial-transacciones");

  // ---- F: SEND ----
  console.log("\n6. Send...");
  await page.goto(`${BASE_URL}/send`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "send", "info", "/send", "pantalla-envio");

  // ---- G: SCAN ----
  console.log("\n7. Scan...");
  await page.goto(`${BASE_URL}/scan`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "scan", "info", "/scan", "pantalla-scan");

  // ---- H: PLANNING ----
  console.log("\n8. Planning...");
  await page.goto(`${BASE_URL}/planning`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "planning", "info", "/planning", "planning-principal");

  // ---- I: GOALS ----
  console.log("\n9. Goals...");
  await page.goto(`${BASE_URL}/goals`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "goals", "info", "/goals", "metas-lista");

  // ---- J: NOTIFICATIONS ----
  console.log("\n10. Notifications...");
  await page.goto(`${BASE_URL}/notifications`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "notifications", "info", "/notifications", "notificaciones");

  // ---- K: COACH IA ----
  console.log("\n11. Coach IA...");
  await page.goto(`${BASE_URL}/coach-ia`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "coach-ia", "info", "/coach-ia", "coach-ia-chat");
  const coachInput = await page.locator("input, textarea").count();
  if (coachInput === 0) issues.push({
    severity: "high", module: "coach-ia", route: "/coach-ia",
    problem: "No hay campo de input en Coach IA", impact: "Usuario no puede chatear",
    cause: "Componente no cargado o gated por plan", recommendation: "Verificar render del chat"
  });

  // ---- L: PROFILE ----
  console.log("\n12. Profile...");
  await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "profile", "info", "/profile", "perfil-usuario");

  // ---- M: SETTINGS ----
  console.log("\n13. Settings...");
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "settings", "info", "/settings", "ajustes-principal");

  // Settings subpages
  const settingsPages = [
    { name: "plan", url: "/settings/plan" },
    { name: "categories", url: "/settings/categories" },
    { name: "security", url: "/settings/security" },
    { name: "security-privacy", url: "/settings/security-privacy" },
    { name: "reports", url: "/settings/reports" },
    { name: "subscriptions", url: "/settings/subscriptions" },
    { name: "help", url: "/settings/help" },
    { name: "about", url: "/settings/about" },
  ];
  for (const sp of settingsPages) {
    console.log(`   Settings: ${sp.url}`);
    await page.goto(`${BASE_URL}${sp.url}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await capturePage(page, "settings", "info", sp.url, `ajustes-${sp.name}`);
  }

  // ---- N: SUBSCRIPTIONS (from settings/subscriptions) ----
  console.log("\n14. Subscriptions (detail)...");
  await page.goto(`${BASE_URL}/settings/subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  // try clicking a subscription if any
  const subLinks = page.locator('a[href*="/subscriptions/"]');
  if (await subLinks.count() > 0) {
    const href = await subLinks.first().getAttribute("href");
    await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await capturePage(page, "subscriptions", "info", href, "detalle-suscripcion");
  }

  // ---- O: LEGAL ----
  console.log("\n15. Legal pages...");
  const legalRoutes = [
    { name: "terminos", url: "/legal/terminos" },
    { name: "privacidad", url: "/legal/privacidad" },
    { name: "aviso-legal", url: "/legal/aviso-legal" },
  ];
  for (const lr of legalRoutes) {
    await page.goto(`${BASE_URL}${lr.url}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1000);
    await capturePage(page, "legal", "info", lr.url, lr.name);
  }

  // ---- P: QA ----
  console.log("\n16. Q&A...");
  await page.goto(`${BASE_URL}/qa`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capturePage(page, "qa", "info", "/qa", "preguntas-frecuentes");

  // ---- SCROLL ANALYSIS on Dashboard ----
  console.log("\n17. Scroll/overlap analysis on Dashboard...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  // Check page dimensions vs viewport
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportH = 932;
  if (pageHeight > viewportH * 3) {
    issues.push({
      severity: "medium", module: "dashboard", route: "/",
      problem: `Dashboard muy largo: ${Math.round(pageHeight/800)} pantallas de scroll`,
      impact: "Usuario scrollea mucho en móvil", cause: "Muchos cards apilados sin acordeón",
      recommendation: "Considerar secciones colapsables o tabs"
    });
  }

  // Check bottom nav visibility
  const bottomNavVisible = await page.locator('[class*="bottom-nav"], nav').last().isVisible().catch(() => false);

  // ---- AUTH PAGES ----
  console.log("\n18. Auth pages...");
  // Logout to see auth pages
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capturePage(page, "auth", "info", "/auth/login", "login");

  await page.goto(`${BASE_URL}/auth/sign-up`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capturePage(page, "auth", "info", "/auth/sign-up", "registro");

  await page.goto(`${BASE_URL}/auth/forgot-password`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capturePage(page, "auth", "info", "/auth/forgot-password", "olvide-contrasena");

  await page.goto(`${BASE_URL}/auth/error`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capturePage(page, "auth", "info", "/auth/error", "error-auth");

  // ---- LOGOUT / LANDING ----
  console.log("\n19. Public landing...");
  await page.goto(`${BASE_URL}/inicio`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capturePage(page, "public", "info", "/inicio", "landing-publica");

  // ---- SUMMARY ----
  console.log("\n=== AUDIT COMPLETE ===");

  // Generate audit log
  const auditLog = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: "430x932 (mobile)",
    screenshots: screenshots.length,
    issues: issues.length,
    issuesBySeverity: {
      critical: issues.filter(i => i.severity === "critical").length,
      high: issues.filter(i => i.severity === "high").length,
      medium: issues.filter(i => i.severity === "medium").length,
      low: issues.filter(i => i.severity === "low").length,
    },
    issues,
    screenshots: screenshots.map(s => ({
      ...s,
      filepath: path.relative(process.cwd(), s.filepath)
    }))
  };

  const logPath = path.join(LOG_DIR, "audit-log.json");
  await fs.writeFile(logPath, JSON.stringify(auditLog, null, 2), "utf-8");
  console.log(`Audit log saved: ${logPath}`);

  await browser.close();

  // Print summary
  console.log(`\n=== RESULTS ===`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Issues found: ${issues.length}`);
  console.log(`  Critical: ${auditLog.issuesBySeverity.critical}`);
  console.log(`  High: ${auditLog.issuesBySeverity.high}`);
  console.log(`  Medium: ${auditLog.issuesBySeverity.medium}`);
  console.log(`  Low: ${auditLog.issuesBySeverity.low}`);
  console.log(`\nScreenshots dir: ${AUDIT_DIR}`);
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
