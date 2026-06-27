"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Fingerprint, Shield, Smartphone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { disablePasskey, isPasskeyEnabled, isPasskeySupported, registerPasskey } from "@/lib/passkey"

export default function SecurityPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false)
  const [supported, setSupported] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setSupported(isPasskeySupported())
    setIsBiometricEnabled(isPasskeyEnabled())
    setHydrated(true)
  }, [])
  const [isEnabling, setIsEnabling] = useState(false)

  const toggleBiometrics = async () => {
    if (!supported) {
      toast({ title: "No disponible", description: "Tu dispositivo no soporta Passkeys." })
      return
    }

    if (!isBiometricEnabled) {
      if (!user) return
      setIsEnabling(true)
      try {
        await registerPasskey(user.id, user.email || "MiCuadre")
        setIsBiometricEnabled(true)
        toast({ title: "Biometría activada", description: "Face ID / huella habilitado para desbloquear la app." })
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo activar"
        toast({ title: "Error", description: message })
      } finally {
        setIsEnabling(false)
      }
      return
    }

    disablePasskey()
    setIsBiometricEnabled(false)
    toast({ title: "Biometría desactivada", description: "El desbloqueo biométrico fue desactivado." })
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
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

      <div className="mx-auto max-w-md space-y-6 px-6 pt-6">
        <div className="overflow-hidden rounded-2xl bg-card">
          <Link href="/settings/security/change-password" className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Shield className="h-5 w-5" /></div>
              <div>
                <p className="font-medium text-foreground">Cambiar contraseña</p>
                <p className="text-xs text-muted-foreground">Abre ventana dedicada para actualizarla</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="mx-4 h-px bg-border" />
          <button type="button" onClick={toggleBiometrics} disabled={isEnabling} className="flex w-full items-center justify-between p-4 disabled:opacity-70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Fingerprint className="h-5 w-5" /></div>
              <div className="text-left">
                <p className="font-medium text-foreground">Desbloqueo con Face ID / Huella</p>
                <p className="text-xs text-muted-foreground">{supported ? (isBiometricEnabled ? "Activado" : "Desactivado") : "No compatible"}</p>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isBiometricEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
              {isEnabling ? "Configurando..." : isBiometricEnabled ? "Activo" : "Activar"}
            </span>
          </button>
        </div>

        <div className="rounded-2xl bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Smartphone className="h-5 w-5" /></div>
            <div>
              <p className="font-medium text-foreground">Sesión actual</p>
              <p className="text-xs text-muted-foreground">Dispositivo activo protegido por autenticación</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
