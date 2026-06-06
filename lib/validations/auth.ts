import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().min(1, "El correo es requerido").email("Correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
})

export const signupSchema = z.object({
  firstName: z.string().min(1, "Tu nombre es requerido").min(2, "Mínimo 2 caracteres"),
  email: z.string().min(1, "El correo es requerido").email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>