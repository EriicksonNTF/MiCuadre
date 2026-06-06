"use client"

import { useEffect } from "react"
import { useProfile } from "@/hooks/use-data"
import { setPreferredCurrency } from "@/lib/data"

export function ProfilePreferencesSync() {
  const { data: profile } = useProfile()

  useEffect(() => {
    if (profile?.preferred_currency) {
      setPreferredCurrency(profile.preferred_currency)
    }
  }, [profile?.preferred_currency])

  return null
}
