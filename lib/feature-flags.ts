const COACH_IA_ALLOWED_EMAILS = ["example@example.com"]

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase()
}

export function isCoachIAEnabledForEmail(email?: string | null) {
  const normalized = normalizeEmail(email)
  return COACH_IA_ALLOWED_EMAILS.includes(normalized)
}
