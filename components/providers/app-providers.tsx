"use client"

import { useEffect } from "react"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ProfilePreferencesSync } from "@/components/providers/profile-preferences-sync"
import { PasskeyLockGate } from "@/components/security/passkey-lock-gate"
import { ThemeColor } from "@/components/providers/theme-color"

export function AppProviders({
  children,
  bodyCleanup = null,
  offlineBanner = null,
  toastContainer = null,
}: {
  children: React.ReactNode
  bodyCleanup?: React.ReactNode
  offlineBanner?: React.ReactNode
  toastContainer?: React.ReactNode
}) {
  useEffect(() => {
    try {
      const { initSyncEngine } = require("@/lib/offline/sync-engine")
      initSyncEngine()
    } catch (e) {
      console.error("Failed to init sync engine:", e)
    }
  }, [])

  return (
    <ThemeProvider>
      <ThemeColor />
      <ProfilePreferencesSync />
      <PasskeyLockGate />
      {bodyCleanup}
      {offlineBanner}
      {children}
      {toastContainer}
      <Toaster />
    </ThemeProvider>
  )
}
