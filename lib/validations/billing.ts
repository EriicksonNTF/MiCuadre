import { z } from "zod"

export const billingCheckoutSchema = z.object({
  plan: z.literal("pro"),
  interval: z.enum(["monthly", "yearly"]),
})

export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>
