"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { PublicLanding } from "@/components/landing/public-landing"
import { createClient } from "@/lib/supabase/client"

export default function RootPage() {
  const router = useRouter()
  const [showLanding, setShowLanding] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          router.replace("/dashboard")
          return
        }

        const isCapacitor = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()

        if (isCapacitor) {
          router.replace("/auth/login")
          return
        }

        setShowLanding(true)
      })
      .catch(() => {
        router.replace("/auth/login")
      })
  }, [router])

  if (!showLanding) return null
  return <PublicLanding />
}
