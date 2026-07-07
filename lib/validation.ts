import { z } from "zod"

export const currencySchema = z.enum(["DOP", "USD"])
export const accountTypeSchema = z.enum(["cash", "debit", "credit"])
export const transactionTypeSchema = z.enum(["income", "expense"])

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
  date: z.string().optional(),
}).refine(
  (data) => data.fromAccountId !== data.toAccountId,
  { message: "La cuenta de origen y destino deben ser diferentes", path: ["toAccountId"] }
)

export type TransferInput = z.infer<typeof transferSchema>

export function parseAmount(value: string): number {
  return parseFloat(value.replace(/[^0-9.]/g, "")) || 0
}