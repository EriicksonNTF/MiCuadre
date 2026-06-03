"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, Eye, EyeOff, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  const { toast } = useToast()

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 8 caracteres." })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden." })
      return
    }

    setIsChanging(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({ title: "Contraseña actualizada", description: "Tu contraseña fue cambiada exitosamente." })
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar la contraseña." })
    } finally {
      setIsChanging(false)
    }
  }

  const isValid = currentPassword.length >= 8 && newPassword.length >= 8 && newPassword === confirmPassword

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings/security" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold">Cambiar contraseña</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-6 pt-6">
        <div className="rounded-2xl bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Seguridad de acceso</p>
              <p className="text-sm text-muted-foreground">Usa mínimo 8 caracteres</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="current-password" className="mb-2 block text-sm font-medium">Contraseña actual</label>
              <div className="relative">
                <input id="current-password" type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-10" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2">{showCurrent ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}</button>
              </div>
            </div>
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium">Nueva contraseña</label>
              <div className="relative">
                <input id="new-password" type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-10" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2">{showNew ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}</button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Confirmar contraseña</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3" />
            </div>
            <Button onClick={handleChangePassword} disabled={!isValid || isChanging} className="h-12 w-full rounded-xl font-semibold">{isChanging ? "Cambiando..." : "Actualizar contraseña"}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
