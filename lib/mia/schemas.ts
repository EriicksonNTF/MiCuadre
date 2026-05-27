import { z } from "zod"

export const coachRequestSchema = z.object({
  message: z.string().trim().min(1, "Mensaje vacio").max(500, "Mensaje muy largo").optional(),
  screenContext: z.string().trim().max(120).optional(),
  confirmAction: z
    .object({
      mutationType: z.enum(["create_transaction", "create_goal", "create_subscription", "add_money_to_goal"]),
      payload: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
}).refine((value) => Boolean(value.message || value.confirmAction), {
  message: "Mensaje vacio",
})

export const draftTransactionSchema = z.object({
  amount: z.number().nonnegative(),
  category: z.string().min(1),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
})

export const draftGoalSchema = z.object({
  name: z.string().min(2),
  targetAmount: z.number().positive(),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
})

export type CoachRequestInput = z.infer<typeof coachRequestSchema>
