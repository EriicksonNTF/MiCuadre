"use client"

import { useEffect } from "react"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ProfilePreferencesSync } from "@/components/providers/profile-preferences-sync"
import { PasskeyLockGate } from "@/components/security/passkey-lock-gate"

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
    const { initSyncEngine } = require("@/lib/offline/sync-engine")
    initSyncEngine()
  }, [])

  return (
    <ThemeProvider>
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
