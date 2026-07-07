// ── Shared enum schemas ──────────────────────────────────────────
export { currencySchema, accountTypeSchema, transactionTypeSchema } from "@/lib/validation"

// ── Auth ─────────────────────────────────────────────────────────
export { loginSchema, signupSchema } from "@/lib/validations/auth"
export type { LoginInput, SignupInput } from "@/lib/validations/auth"

// ── Billing ──────────────────────────────────────────────────────
export { billingCheckoutSchema } from "@/lib/validations/billing"
export type { BillingCheckoutInput } from "@/lib/validations/billing"

// ── Notifications ────────────────────────────────────────────────
export { notificationPreferencesSchema } from "@/lib/validations/notifications"
export type { NotificationPreferencesInput } from "@/lib/validations/notifications"

// ── Transfers (from legacy validation) ──────────────────────────
export { transferSchema, parseAmount } from "@/lib/validation"

// ── MIA / Coach IA ───────────────────────────────────────────────
export { coachRequestSchema, draftTransactionSchema, draftGoalSchema } from "@/lib/mia/schemas"
export type { CoachRequestInput } from "@/lib/mia/schemas"
