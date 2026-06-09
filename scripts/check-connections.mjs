#!/usr/bin/env node

/**
 * check-connections.mjs
 *
 * Diagnóstico de conexiones externas: Supabase, Stripe, LLM.
 * Uso: node scripts/check-connections.mjs
 *
 * NUNCA imprime el valor de las claves.
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// Manual .env.local loader (no dotenv dependency)
const __dirname = dirname(fileURLToPath(import.meta.url))
function loadEnv(file) {
  try {
    const text = readFileSync(file, "utf-8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* file not found, ignore */ }
}
loadEnv(resolve(__dirname, "..", ".env.local"))
loadEnv(resolve(__dirname, "..", ".env"))

const SEP = "─".repeat(56)

function mask(val) {
  if (!val) return "❌ AUSENTE"
  if (val.length < 12) return "⚠️  PRESENTE (muy corta, posiblemente placeholder)"
  return "✅ PRESENTE"
}

function title(label) {
  console.log(`\n${SEP}\n  ${label}\n${SEP}`)
}

function ok(msg) {
  console.log(`  ✅ [OK]     ${msg}`)
}

function fail(msg) {
  console.log(`  ❌ [FALLA]  ${msg}`)
}

function warn(msg) {
  console.log(`  ⚠️  [WARN]   ${msg}`)
}

function required(key) {
  const v = process.env[key]
  return v && v.trim().length > 0 ? v.trim() : null
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║        MiCuadre — Connection Diagnostics                ║
║        node scripts/check-connections.mjs                ║
╚══════════════════════════════════════════════════════════╝
`)

// ── 1. Env var presence check ──────────────────────────
title("1. ENV VAR PRESENCE")

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]

const OPTIONAL_CODE = [
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "STRIPE_CHECKOUT_ENABLE_PAYPAL",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_BUSINESS_PRICE_ID",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL",
  "LLM_API_KEY",
  "LLM_API_BASE",
  "LLM_MODEL",
  "LLM_MODEL_FALLBACKS",
  "COACH_IA_ALLOWED_EMAILS",
  "CRON_SECRET",
  "MIA_RATE_LIMIT_PER_MINUTE",
  "MIA_RATE_LIMIT_PER_DAY",
]

let allRequiredPresent = true

for (const key of REQUIRED) {
  const val = required(key)
  if (!val) {
    fail(`${key}  →  ${mask(val)}`)
    allRequiredPresent = false
  } else {
    ok(`${key}  →  ${mask(val)}`)
  }
}

console.log("")
for (const key of OPTIONAL_CODE) {
  const val = required(key)
  if (val) {
    ok(`${key}  →  ${mask(val)}`)
  } else {
    warn(`${key}  →  ${mask(val)}`)
  }
}

// Detect orphaned env vars
const ALL_KNOWN = new Set([...REQUIRED, ...OPTIONAL_CODE])
const ORPHAN_CANDIDATES = ["GEMINI_API_KEY", "GEMINI_MODEL"]
for (const key of ORPHAN_CANDIDATES) {
  if (required(key)) {
    warn(`${key}  →  ✅ PRESENTE (PERO NO USADO EN CÓDIGO — candidato a limpieza)`)
  }
}

// ── 2. Supabase connection (anon client) ──────────────
title("2. SUPABASE — Cliente anon (browser-equivalent)")

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL")
const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if (supabaseUrl && supabaseAnonKey) {
  try {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await anonClient.auth.getUser()
    // This will likely return no user (we're not authenticated), which is fine — it proves the endpoint is reachable
    if (error && !error.message?.includes("Auth session missing")) {
      fail(`getUser falló: ${error.message.slice(0, 80)}`)
    } else {
      ok("Endpoint reachable (getUser respondió con 'no session' o éxito)")
    }
  } catch (err) {
    fail(`No se pudo conectar: ${err.message?.slice(0, 100) || String(err)}`)
  }
} else {
  fail("Saltado — faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

// ── 3. Supabase admin (service_role) ────────────────
title("3. SUPABASE — Cliente admin (service_role)")

const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY")

if (supabaseUrl && serviceRoleKey) {
  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await adminClient.from("profiles").select("id").limit(1)
    if (error) {
      fail(`Query a profiles falló: ${error.message.slice(0, 100)}`)
    } else {
      ok(`Query exitosa (profiles devolvió ${data?.length || 0} filas)`)
    }
  } catch (err) {
    fail(`No se pudo conectar: ${err.message?.slice(0, 100) || String(err)}`)
  }
} else {
  fail("Saltado — faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
}

// ── 4. RLS verification (spot check) ─────────────────
title("4. SUPABASE — RLS activa (spot-check)")

if (supabaseUrl && serviceRoleKey) {
  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: tables, error } = await adminClient.rpc("get_rls_tables_status")
    if (error) {
      // rpc may not exist — try a simpler check
      warn(`No se pudo verificar RLS vía RPC (${error.message.slice(0, 80)})`)
      warn("Ver RLS manual: SELECT relname FROM pg_class WHERE relrowsecurity = true;")
    } else if (tables) {
      ok(`RLS activa en ${tables.length} tablas`)
    }
  } catch (err) {
    warn(`Spot-check RLS omitido: ${err.message?.slice(0, 80) || String(err)}`)
  }
} else {
  fail("Saltado — faltan credenciales admin")
}

// ── 5. Stripe ─────────────────────────────────────────
title("5. STRIPE — SDK + API call")

const stripeSecretKey = required("STRIPE_SECRET_KEY")

if (stripeSecretKey) {
  try {
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(stripeSecretKey)
    const balance = await stripe.balance.retrieve()
    const mode = stripeSecretKey.startsWith("sk_live") ? "🔴 LIVE" : "🟡 TEST"
    ok(`Conexión exitosa (${mode})`)
    ok(`Balance: ${(balance.available || []).map(b => `${b.amount / 100} ${b.currency?.toUpperCase()}`).join(", ") || "0"}`)
  } catch (err) {
    fail(`No se pudo conectar: ${err.message?.slice(0, 100) || String(err)}`)
  }
} else {
  fail("Saltado — STRIPE_SECRET_KEY ausente")
}

// ── 6. Stripe webhook secret ──────────────────────────
title("6. STRIPE — Webhook secret")

const whsec = required("STRIPE_WEBHOOK_SECRET")
if (whsec) {
  const whMode = whsec.startsWith("whsec_") ? "Formato correcto" : "⚠️  Formato inesperado"
  ok(`${whMode} (${whsec.length} chars)`)
} else {
  fail("Saltado — STRIPE_WEBHOOK_SECRET ausente")
}

// ── 7. Stripe price IDs ───────────────────────────────
title("7. STRIPE — Price IDs")

const priceIdVars = [
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_BUSINESS_PRICE_ID",
]
for (const key of priceIdVars) {
  const val = required(key)
  if (!val) {
    warn(`${key}  →  ausente`)
  } else if (val.startsWith("price_")) {
    ok(`${key}  →  formato price_xxx correcto`)
  } else if (val === "price_xxxxxxxxxxxxx") {
    warn(`${key}  →  PLACEHOLDER (price_xxxxxxxxxxxxx) — no es funcional`)
  } else {
    warn(`${key}  →  valor presente pero formato inesperado (posiblemente live URL?)`)
  }
}

// ── 8. Stripe key mode consistency ────────────────────
title("8. STRIPE — Consistencia test/live")

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
if (stripeSecretKey || pk) {
  if (stripeSecretKey?.startsWith("sk_live") && pk && !pk.startsWith("pk_live")) {
    fail("MEZCLA: sk_live (secret) + pk_test (publishable)")
  } else if (stripeSecretKey?.startsWith("sk_test") && pk && !pk.startsWith("pk_test")) {
    fail("MEZCLA: sk_test (secret) + pk_live (publishable)")
  } else if (stripeSecretKey || pk) {
    ok("Modo consistente (o solo una clave presente)")
  }
} else {
  warn("No hay claves Stripe para verificar consistencia")
}

// ── 9. LLM / MIA ──────────────────────────────────────
title("9. LLM — Conexión a proveedor")

const llmKey = required("LLM_API_KEY")
const llmBase = required("LLM_API_BASE") || "https://openrouter.ai/api/v1"
const llmModel = required("LLM_MODEL") || "z-ai/glm-4.5-air:free"

if (llmKey) {
  try {
    const response = await fetch(`${llmBase.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${llmKey}` },
    })
    if (response.ok) {
      ok(`API reachable en ${llmBase}`)
    } else if (response.status === 401) {
      fail(`API rechazó la API key (HTTP 401) en ${llmBase}`)
    } else {
      warn(`HTTP ${response.status} desde ${llmBase}`)
    }
  } catch (err) {
    fail(`No se pudo conectar a ${llmBase}: ${err.message?.slice(0, 80) || String(err)}`)
  }
} else {
  warn("Saltado — LLM_API_KEY ausente (MIA usará fallback offline)")
}

// ── Summary ────────────────────────────────────────────
console.log(`\n${SEP}`)
if (!allRequiredPresent) {
  console.log("  ⚠️  FALTAN VARIABLES OBLIGATORIAS — la app fallará en runtime")
  console.log("     Revisa .env.local o las Environment Variables en Vercel.")
}
console.log("  Diagnóstico completado.")
console.log("  NOTA: Las credenciales solo existen en el entorno actual.\n")
