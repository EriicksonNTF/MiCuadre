"use client"

import { useEffect, useState } from "react"
import { Fingerprint, ShieldCheck } from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { isPasskeyEnabled, verifyPasskeyUnlock } from "@/lib/passkey"

const PASSKEY_UNLOCK_SESSION_KEY = "micuadre_passkey_unlocked_session"

export function PasskeyLockGate() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const [locked, setLocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !user) return
    if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding") || pathname === "/login") {
      return
    }

    const unlockedSession = typeof window !== "undefined" && window.sessionStorage.getItem(PASSKEY_UNLOCK_SESSION_KEY) === user.id

    if (isPasskeyEnabled() && !unlockedSession) {
      setLocked(true)
    }
  }, [loading, pathname, user])

  const handleUnlock = async () => {
    setUnlocking(true)
    setMessage(null)
    try {
      await verifyPasskeyUnlock()
      if (typeof window !== "undefined" && user) {
        window.sessionStorage.setItem(PASSKEY_UNLOCK_SESSION_KEY, user.id)
      }
      setLocked(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo desbloquear"
      setMessage(msg)
    } finally {
      setUnlocking(false)
    }
  }

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 px-6 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Desbloquear MiCuadre</h2>
        <p className="mt-1 text-sm text-muted-foreground">Usa Face ID, huella o tu método biométrico disponible.</p>
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-70"
        >
          <Fingerprint className="h-4 w-4" />
          {unlocking ? "Verificando..." : "Desbloquear"}
        </button>
        {message && <p className="mt-3 text-xs text-destructive">{message}</p>}
      </div>
    </div>
  )
}
