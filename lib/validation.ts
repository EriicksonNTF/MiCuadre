import { z } from "zod"

export const currencySchema = z.enum(["DOP", "USD"])
export const accountTypeSchema = z.enum(["cash", "debit", "credit"])
export const transactionTypeSchema = z.enum(["income", "expense"])

export const createAccountSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50, "Máximo 50 caracteres"),
  type: accountTypeSchema,
  currency: currencySchema,
  initialBalance: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(/[^0-9.]/g, ""))
      return !isNaN(num) && num >= 0
    },
    { message: "Monto inválido" }
  ),
  creditLimit: z.string().optional(),
  closingDate: z.string().optional(),
  dueDate: z.string().optional(),
})

export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  accountId: z.string().min(1, "La cuenta es requerida"),
  categoryId: z.string().optional(),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(/[^0-9.]/g, ""))
      return !isNaN(num) && num > 0
    },
    { message: "El monto debe ser mayor a 0" }
  ),
  description: z.string().min(1, "La descripción es requerida").max(100, "Máximo 100 caracteres"),
  date: z.string().min(1, "La fecha es requerida"),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
})

export const transferSchema = z.object({
  fromAccountId: z.string().min(1, "La cuenta de origen es requerida"),
  toAccountId: z.string().min(1, "La cuenta de destino es requerida"),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(/[^0-9.]/g, ""))
      return !isNaN(num) && num > 0
    },
    { message: "El monto debe ser mayor a 0" }
  ),
  description: z.string().max(100, "Máximo 100 caracteres").optional(),
})

export const createGoalSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50, "Máximo 50 caracteres"),
  targetAmount: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(/[^0-9.]/g, ""))
      return !isNaN(num) && num > 0
    },
    { message: "El monto objetivo debe ser mayor a 0" }
  ),
  targetDate: z.string().optional(),
  color: z.string().min(1, "El color es requerido"),
  icon: z.string().min(1, "El icono es requerido"),
})

export const addGoalContributionSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(/[^0-9.]/g, ""))
      return !isNaN(num) && num > 0
    },
    { message: "El monto debe ser mayor a 0" }
  ),
})

export const profileSchema = z.object({
  firstName: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  lastName: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  preferredCurrency: currencySchema.optional(),
  language: z.enum(["es", "en"]).optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type TransferInput = z.infer<typeof transferSchema>
export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type AddGoalContributionInput = z.infer<typeof addGoalContributionSchema>
export type ProfileInput = z.infer<typeof profileSchema>

export function getFieldError<T>(schema: z.ZodSchema<T>, field: keyof T, value: unknown): string | undefined {
  const result = schema.safeParse({ [field]: value })
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === field)
    return error?.message
  }
  return undefined
}

export function parseAmount(value: string): number {
  return parseFloat(value.replace(/[^0-9.]/g, "")) || 0
}