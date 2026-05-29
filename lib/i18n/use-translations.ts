"use client"

import { useMemo } from "react"
import { useProfile } from "@/hooks/use-data"
import { translations, type Locale } from "@/lib/i18n/translations"

export function useTranslations() {
  const { data: profile } = useProfile()
  const locale: Locale = profile?.language === "en" ? "en" : "es"

  return useMemo(() => ({
    locale,
    t: translations[locale],
  }), [locale])
}
