"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError("Debes ingresar un correo")
      return
    }

    const supabase = createClient()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setMessage("Te enviamos un correo para restablecer tu contrasena")
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar contrasena</CardTitle>
          <CardDescription>Ingresa tu correo para recibir el enlace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            {message && <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-600">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Enviando..." : "Enviar enlace"}</Button>
          </form>
          <Link href="/auth/login" className="mt-4 block text-center text-sm text-primary hover:underline">Volver a iniciar sesion</Link>
        </CardContent>
      </Card>
    </div>
  )
}
