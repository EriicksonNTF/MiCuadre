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

const allIssues = [];
const allConsole = [];
const screenshots = [];

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

function slug(text) {
  return text.toLowerCase()
    .replace(/[áéíóú]/g, (c) => "aeiou"["áéíóú".indexOf(c)])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|--+/g, "-")
    .replace(/^-|-$/g, "");
}

async function capture(page, module, severity, routePath, problem) {
  const moduleDir = path.join(AUDIT_DIR, slug(module));
  await ensureDir(moduleDir);
  const filename = `${severity}__${slug(routePath)}__${slug(problem || "captura")}.png`;
  const filepath = path.join(moduleDir, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: true });
  } catch (e) {
    console.warn(`Screenshot failed for ${problem}: ${e.message}`);
    return null;
  }
  screenshots.push({ module: slug(module), severity, routePath, problem, filepath, filename });
  return filepath;
}

async function captureSheet(page, module, severity, routePath, problem) {
  await page.waitForTimeout(800);
  return capture(page, module, severity, routePath, problem);
}

function reportPage(page) {
  page.on("console", (msg) => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    allConsole.push(text);
    if (msg.type() === "error") allIssues.push({
      severity: "high", module: "runtime", route: page.url(),
      problem: `Console error: ${msg.text()}`, impact: "Posible error de JS",
      cause: "Error en runtime del navegador", recommendation: "Revisar consola"
    });
  });
  page.on("pageerror", (err) => {
    allConsole.push(`[PAGE_ERROR] ${err.message}`);
    allIssues.push({
      severity: "critical", module: "runtime", route: page.url(),
      problem: `Page error: ${err.message}`, impact: "Aplicación puede no funcionar",
      cause: "Error no capturado en React", recommendation: "Revisar stack trace"
    });
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) allConsole.push(`[HTTP ${resp.status()}] ${resp.url()}`);
  });
}

async function tryClick(page, text, timeout = 5000) {
  try {
    const btn = page.locator(`button:has-text("${text}"), a:has-text("${text}")`).first();
    await btn.waitFor({ timeout });
    await btn.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function tryClickIcon(page, iconClass, timeout = 5000) {
  try {
    const icon = page.locator(`[class*="${iconClass}"]`).first();
    await icon.waitFor({ timeout });
    await icon.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function closeOpenSheet(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // try clicking backdrop
  try {
    const backdrop = page.locator('[data-state="open"][data-overlay], [class*="overlay"]').first();
    if (await backdrop.isVisible({ timeout: 2000 })) {
      await backdrop.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
    }
  } catch { /* ignore */ }
}

async function closeModal(page) {
  // Try close button
  await tryClick(page, "Cancelar", 2000);
  await tryClick(page, "Cerrar", 2000);
  await tryClick(page, "Volver", 2000);
  await tryClickIcon(page, "x", 2000);
  await tryClickIcon(page, "close", 2000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

// ---- MAIN AUDIT ----
async function runDeepAudit() {
  await ensureDir(AUDIT_DIR);
  await ensureDir(LOG_DIR);

  console.log("=== MI CUADRE DEEP FORM AUDIT ===");
  console.log(`Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });
  const page = await context.newPage();
  reportPage(page);

  // ---- LOGIN ----
  console.log("\n=== LOGIN ===");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30000 });
  } catch { console.warn("Login redirect timeout"); }
  await page.waitForTimeout(3000);
  console.log(`Logged in. URL: ${page.url()}`);

  // =================================================
  // 1. ACCOUNTS — FORMS & MODALS
  // =================================================
  console.log("\n=== 1. ACCOUNTS ===");
  await page.goto(`${BASE_URL}/accounts`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "accounts", "info", "/accounts", "lista-cuentas");

  // Create Account modal
  if (await tryClick(page, "+")) {
    await captureSheet(page, "accounts", "info", "/accounts", "modal-crear-cuenta");
    await closeModal(page);
  }

  // Transfer modal
  if (await tryClickIcon(page, "arrow-left-right", 3000) || await tryClickIcon(page, "ArrowLeftRight", 3000)) {
    await captureSheet(page, "accounts", "info", "/accounts", "modal-transferir");
    await closeModal(page);
  }

  // ---- Account Detail ----
  const accountLink = page.locator('a[href*="/accounts/"]').first();
  if (await accountLink.isVisible().catch(() => false)) {
    const href = await accountLink.getAttribute("href");
    await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await capture(page, "accounts", "info", href, "detalle-cuenta");

    // Edit account (pencil in header)
    if (await tryClickIcon(page, "edit", 3000) || await tryClickIcon(page, "pencil", 3000)) {
      await captureSheet(page, "accounts", "info", href, "modal-editar-cuenta");
      await closeModal(page);
    }

    // Pay card (if credit card)
    if (await tryClick(page, "Pagar tarjeta", 3000) || await tryClick(page, "Pagar", 3000)) {
      await captureSheet(page, "accounts", "info", href, "boton-pagar-tarjeta");
    }

    // Edit transaction (pencil on a transaction row)
    const txEditBtn = page.locator('button:has([class*="pencil"]), button:has([class*="edit"]), [class*="pencil"]').first();
    if (await txEditBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1500);
      await tryClickIcon(page, "pencil", 3000);
      await captureSheet(page, "transactions", "info", href, "modal-editar-transaccion");
      await closeModal(page);
    }
  }

  // =================================================
  // 2. TRANSACTIONS (EXPENSE + HISTORY)
  // =================================================
  console.log("\n=== 2. TRANSACTIONS ===");
  await page.goto(`${BASE_URL}/expense`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "transactions", "info", "/expense", "formulario-gasto");
  // Fill some fields to show the form in use
  try {
    await page.locator('input[inputMode="decimal"]').first().fill("1500.50", { timeout: 3000 });
  } catch { /* ignore if no decimal field */ }
  // Open category modal - try clicking "Nueva" or "+" in category section
  if (await tryClick(page, "Nueva")) {
    await captureSheet(page, "transactions", "info", "/expense", "modal-nueva-categoria");
    await closeModal(page);
  }

  // History page - edit/delete transaction
  await page.goto(`${BASE_URL}/history`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "transactions", "info", "/history", "historial");
  const historyEdit = page.locator('button:has([class*="pencil"]), button:has([class*="edit"])').first();
  if (await historyEdit.isVisible({ timeout: 3000 }).catch(() => false)) {
    await historyEdit.click();
    await page.waitForTimeout(800);
    await captureSheet(page, "transactions", "info", "/history", "modal-editar-historial");
    await closeModal(page);
  }
  // Try delete
  const historyDelete = page.locator('button:has([class*="trash"]), button:has([class*="Trash"])').first();
  if (await historyDelete.isVisible({ timeout: 2000 }).catch(() => false)) {
    await historyDelete.click();
    await page.waitForTimeout(800);
    await captureSheet(page, "transactions", "info", "/history", "modal-eliminar-historial");
    await closeModal(page);
  }

  // =================================================
  // 3. PAY CARD — SHEETS & CONFIRM
  // =================================================
  console.log("\n=== 3. PAY ===");
  // First get the raw pay page
  await page.goto(`${BASE_URL}/pay`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "pay", "info", "/pay", "pantalla-pago");

  // Try opening Custom Amount sheet (click "Otro monto")
  if (await tryClick(page, "Otro monto", 3000)) {
    await captureSheet(page, "pay", "info", "/pay", "sheet-monto-personalizado");
    await closeModal(page);
  }

  // =================================================
  // 4. SEND — FORM & BENEFICIARY
  // =================================================
  console.log("\n=== 4. SEND ===");
  await page.goto(`${BASE_URL}/send`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "send", "info", "/send", "pantalla-envio");
  if (await tryClick(page, "Agregar beneficiario", 3000)) {
    await captureSheet(page, "send", "info", "/send", "modal-agregar-beneficiario");
    await closeModal(page);
  }

  // Fill send form (if any input present)
  try {
    await page.locator('input[inputMode="decimal"], input[type="number"]').first().fill("500", { timeout: 3000 });
    await capture(page, "send", "info", "/send", "formulario-envio-lleno");
  } catch {
    await capture(page, "send", "info", "/send", "formulario-envio-base");
  }

  // =================================================
  // 5. SCAN
  // =================================================
  console.log("\n=== 5. SCAN ===");
  await page.goto(`${BASE_URL}/scan`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "scan", "info", "/scan", "pantalla-scan");

  // =================================================
  // 6. PLANNING — BUDGETS, DEBTS, CALENDAR
  // =================================================
  console.log("\n=== 6. PLANNING ===");
  await page.goto(`${BASE_URL}/planning`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capture(page, "planning", "info", "/planning", "planning-principal");

  // Try Budget tab first
  if (await tryClick(page, "Presupuestos")) {
    await page.waitForTimeout(1000);
    await capture(page, "planning", "info", "/planning", "tab-presupuestos");
    if (await tryClick(page, "+")) {
      await captureSheet(page, "planning", "info", "/planning", "drawer-crear-presupuesto");
      await closeModal(page);
    }
  }

  // Try Debts tab
  if (await tryClick(page, "Deudas")) {
    await page.waitForTimeout(1000);
    await capture(page, "planning", "info", "/planning", "tab-deudas");
    if (await tryClick(page, "+")) {
      await captureSheet(page, "planning", "info", "/planning", "drawer-crear-deuda");
      await closeModal(page);
    }
  }

  // Try Calendar tab
  if (await tryClick(page, "Calendario") || await tryClick(page, "Calend")) {
    await page.waitForTimeout(1000);
    await capture(page, "planning", "info", "/planning", "tab-calendario");
    // Try clicking a calendar date
    const dateBtn = page.locator('button:has([class*="day"]), [class*="calendar"] button').first();
    if (await dateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateBtn.click();
      await page.waitForTimeout(800);
      await captureSheet(page, "planning", "info", "/planning", "calendario-dia-click");
      await closeModal(page);
    }
  }

  // =================================================
  // 7. GOALS
  // =================================================
  console.log("\n=== 7. GOALS ===");
  await page.goto(`${BASE_URL}/goals`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "goals", "info", "/goals", "metas");

  // =================================================
  // 8. NOTIFICATIONS
  // =================================================
  console.log("\n=== 8. NOTIFICATIONS ===");
  await page.goto(`${BASE_URL}/notifications`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "notifications", "info", "/notifications", "notificaciones");

  // =================================================
  // 9. COACH IA
  // =================================================
  console.log("\n=== 9. COACH IA ===");
  await page.goto(`${BASE_URL}/coach-ia`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capture(page, "coach-ia", "info", "/coach-ia", "coach-ia");

  // =================================================
  // 10. PROFILE
  // =================================================
  console.log("\n=== 10. PROFILE ===");
  await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "profile", "info", "/profile", "perfil");

  // =================================================
  // 11. SETTINGS — FORMS & MODALS
  // =================================================
  console.log("\n=== 11. SETTINGS ===");
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "settings", "info", "/settings", "ajustes");

  // Theme picker
  if (await tryClick(page, "Tema", 3000)) {
    await captureSheet(page, "settings", "info", "/settings", "modal-selector-tema");
    await closeModal(page);
  }
  // Currency picker
  if (await tryClick(page, "Moneda", 3000)) {
    await captureSheet(page, "settings", "info", "/settings", "modal-selector-moneda");
    await closeModal(page);
  }
  // Plan selector
  if (await tryClick(page, "Planes", 3000) || await tryClick(page, "Plan", 3000)) {
    await captureSheet(page, "settings", "info", "/settings", "drawer-planes");
    await closeModal(page);
  }
  // Logout confirm
  if (await tryClick(page, "Cerrar sesion", 3000)) {
    await captureSheet(page, "settings", "info", "/settings", "modal-cerrar-sesion");
    await closeModal(page);
  }

  // ---- Settings Categories ----
  console.log("   Categories form...");
  await page.goto(`${BASE_URL}/settings/categories`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "settings", "info", "/settings/categories", "categorias-lista");
  if (await tryClick(page, "+")) {
    await captureSheet(page, "settings", "info", "/settings/categories", "modal-crear-categoria");
    await closeModal(page);
  }

  // ---- Settings Plan ----
  console.log("   Plan page...");
  await page.goto(`${BASE_URL}/settings/plan`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "settings", "info", "/settings/plan", "plan-actual");

  // ---- Settings Security ----
  console.log("   Security page (after hydration fix)...");
  await page.goto(`${BASE_URL}/settings/security`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capture(page, "settings", "info", "/settings/security", "seguridad");

  // ---- Settings Security/Privacy ----
  await page.goto(`${BASE_URL}/settings/security-privacy`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "settings", "info", "/settings/security-privacy", "seguridad-privacidad");

  // ---- Settings Subscriptions ----
  console.log("   Subscriptions form...");
  await page.goto(`${BASE_URL}/settings/subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "subscriptions", "info", "/settings/subscriptions", "suscripciones-lista");
  if (await tryClick(page, "Nueva", 3000)) {
    await captureSheet(page, "subscriptions", "info", "/settings/subscriptions", "modal-crear-suscripcion");
    await closeModal(page);
  }

  // ---- Settings Reports ----
  console.log("   Reports page...");
  await page.goto(`${BASE_URL}/settings/reports`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "settings", "info", "/settings/reports", "reportes");

  // =================================================
  // 12. DASHBOARD
  // =================================================
  console.log("\n=== 12. DASHBOARD ===");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await capture(page, "dashboard", "info", "/", "dashboard");

  // =================================================
  // 13. AUTH PAGES
  // =================================================
  console.log("\n=== 13. AUTH PAGES ===");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "auth", "info", "/auth/login", "login");
  await page.goto(`${BASE_URL}/auth/sign-up`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "auth", "info", "/auth/sign-up", "registro");
  await page.goto(`${BASE_URL}/auth/forgot-password`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await capture(page, "auth", "info", "/auth/forgot-password", "olvide-contrasena");

  // =================================================
  // SUMMARY
  // =================================================
  console.log("\n=== DEEP AUDIT COMPLETE ===");

  const auditLog = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: "430x932 (mobile)",
    screenshots: screenshots.length,
    issues: allIssues.length,
    issuesBySeverity: {
      critical: allIssues.filter(i => i.severity === "critical").length,
      high: allIssues.filter(i => i.severity === "high").length,
      medium: allIssues.filter(i => i.severity === "medium").length,
      low: allIssues.filter(i => i.severity === "low").length,
    },
    issues: allIssues,
    screenshots: screenshots.map(s => ({
      ...s,
      filepath: path.relative(process.cwd(), s.filepath)
    }))
  };

  const logPath = path.join(LOG_DIR, "audit-log-deep.json");
  await fs.writeFile(logPath, JSON.stringify(auditLog, null, 2), "utf-8");
  console.log(`Audit log: ${logPath}`);

  await browser.close();

  console.log(`\n=== RESULTS ===`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Issues: ${allIssues.length}`);
  console.log(`  Critical: ${auditLog.issuesBySeverity.critical}`);
  console.log(`  High: ${auditLog.issuesBySeverity.high}`);
  console.log(`  Medium: ${auditLog.issuesBySeverity.medium}`);
  console.log(`  Low: ${auditLog.issuesBySeverity.low}`);
  console.log(`\nScreenshots in: ${AUDIT_DIR}`);
}

runDeepAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
