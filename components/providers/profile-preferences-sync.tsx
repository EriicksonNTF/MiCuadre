"use client"

import { useEffect } from "react"
import { useProfile } from "@/hooks/use-data"
import { setPreferredCurrency } from "@/lib/data"
import { useTheme } from "@/components/providers/theme-provider"

export function ProfilePreferencesSync() {
  const { data: profile } = useProfile()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (profile?.preferred_currency) {
      setPreferredCurrency(profile.preferred_currency)
    }
  }, [profile?.preferred_currency])

  useEffect(() => {
    if (profile?.theme) {
      setTheme(profile.theme)
    }
  }, [profile?.theme, setTheme])

  return null
}
