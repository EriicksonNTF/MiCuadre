"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider, useTheme } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { PasskeyLockGate } from "@/components/security/passkey-lock-gate"
import { useProfile } from "@/hooks/use-data"
import { setPreferredCurrency } from "@/lib/data"

function ProfilePreferencesSync() {
  const { data: profile } = useProfile()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!profile) return
    if (profile.theme) {
      setTheme(profile.theme)
    }
    if (profile.preferred_currency) {
      setPreferredCurrency(profile.preferred_currency)
    }
  }, [profile, setTheme])

  return null
}

function RouteFadeTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setIsVisible(false)
    const timer = window.setTimeout(() => setIsVisible(true), 35)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return (
    <div
      className={`transition-opacity duration-200 ease-out ${isVisible ? "opacity-100" : "opacity-0"}`}
    >
      {children}
    </div>
  )
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ProfilePreferencesSync />
      <PasskeyLockGate />
      <RouteFadeTransition>{children}</RouteFadeTransition>
      <Toaster />
    </ThemeProvider>
  )
}
