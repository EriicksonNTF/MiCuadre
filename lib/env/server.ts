import "server-only"

type RequiredServerEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_WEBHOOK_SECRET"

const REQUIRED_KEYS: RequiredServerEnvKey[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]

function readEnv(key: string) {
  const value = process.env[key]
  return value && value.trim().length > 0 ? value : null
}

export function assertServerEnv() {
  const missing: string[] = []

  for (const key of REQUIRED_KEYS) {
    if (!readEnv(key)) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required server env configuration (${missing.join(", ")})`)
  }

  return {
    supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL")!,
    supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
    supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY")!,
    stripeSecretKey: readEnv("STRIPE_SECRET_KEY")!,
    stripeWebhookSecret: readEnv("STRIPE_WEBHOOK_SECRET")!,
    stripeProPriceId: readEnv("STRIPE_PRO_PRICE_ID"),
    stripeBusinessPriceId: readEnv("STRIPE_BUSINESS_PRICE_ID"),
    stripeProMonthlyPriceId: readEnv("STRIPE_PRO_MONTHLY_PRICE_ID"),
    stripeProYearlyPriceId: readEnv("STRIPE_PRO_YEARLY_PRICE_ID"),
    stripePlusMonthlyPriceId: readEnv("STRIPE_PLUS_MONTHLY_PRICE_ID"),
    stripePlusYearlyPriceId: readEnv("STRIPE_PLUS_YEARLY_PRICE_ID"),
  }
}
