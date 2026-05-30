export const TEST_FULL_ACCESS_EMAIL = "example@example.com"

export function isTestFullAccessEmail(email?: string | null) {
  return (email || "").trim().toLowerCase() === TEST_FULL_ACCESS_EMAIL
}
