"use client"

import { useEffect } from "react"
import { ThemeProvider, useTheme } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/toaster"
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

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ProfilePreferencesSync />
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
