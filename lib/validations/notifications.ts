import { z } from "zod"

const ALLOWED_KEYS = ["transactions", "budgets", "creditAlerts", "marketing"] as const

export const notificationPreferencesSchema = z.object(
  ALLOWED_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: z.boolean().optional() }),
    {} as Record<string, z.ZodOptional<z.ZodBoolean>>
  )
).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "Sin cambios válidos" }
)

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>
