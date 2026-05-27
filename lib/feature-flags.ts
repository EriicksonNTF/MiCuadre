const envEmails = process.env.COACH_IA_ALLOWED_EMAILS || process.env.NEXT_PUBLIC_COACH_IA_ALLOWED_EMAILS || ""
const COACH_IA_ALLOWED_EMAILS = envEmails
  ? envEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  : ["example@example.com"]

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase()
}

export function isCoachIAEnabledForEmail(email?: string | null) {
  const normalized = normalizeEmail(email)
  return COACH_IA_ALLOWED_EMAILS.includes(normalized)
}
