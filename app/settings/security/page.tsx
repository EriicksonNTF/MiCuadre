"use client"
import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, Eye, EyeOff, Shield, Smartphone, Clock, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  const [showLogoutDevices, setShowLogoutDevices] = useState(false)

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) return
    setIsChanging(true)
    await new Promise(r => setTimeout(r, 1000))
    setIsChanging(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const isValid = currentPassword.length >= 8 && newPassword.length >= 8 && newPassword === confirmPassword

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold">Seguridad</h1>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-md px-6 pt-6 space-y-6">
        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Cambiar contraseña</p>
              <p className="text-sm text-muted-foreground">Usa 8 caracteres mínimo</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Contraseña actual</label>
              <div className="relative">
                <input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-10" />
                <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showCurrent ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Nueva contraseña</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-10" />
                <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showNew ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3" />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
            <Button onClick={handleChangePassword} disabled={!isValid || isChanging}
              className="h-12 w-full rounded-xl font-semibold">
              {isChanging ? "Cambiando..." : "Actualizar contraseña"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Sesiones activas</p>
                <p className="text-sm text-muted-foreground">1 dispositivo conectado</p>
              </div>
            </div>
            <button onClick={() => setShowLogoutDevices(true)} className="text-sm font-medium text-accent">
              Ver
            </button>
          </div>
          <div className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">iPhone 15 Pro</p>
              <p className="text-sm text-muted-foreground">Santo Domingo · Activo ahora</p>
            </div>
          </div>
        </div>

        <button onClick={() => {}} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Cerrar todas las sesiones</span>
        </button>
      </div>
    </div>
  )
}