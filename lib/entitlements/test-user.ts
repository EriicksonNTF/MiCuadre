const envTestEmail = process.env.COACH_IA_TEST_ACCESS_EMAIL || ""
export const TEST_FULL_ACCESS_EMAIL = envTestEmail || "example@example.com"

export function isTestFullAccessEmail(email?: string | null) {
  return (email || "").trim().toLowerCase() === TEST_FULL_ACCESS_EMAIL
}
