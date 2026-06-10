"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PublicLanding } from "@/components/landing/public-landing"
import { createClient } from "@/lib/supabase/client"

export default function RootPage() {
  const router = useRouter()
  const [showLanding, setShowLanding] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard")
        return
      }

      const ua = navigator.userAgent.toLowerCase()
      const isCapacitor = ua.includes("capacitor") || ua.includes("micuadrenative")

      if (isCapacitor) {
        router.replace("/auth/login")
        return
      }

      setShowLanding(true)
    })
  }, [router])

  if (!showLanding) return null
  return <PublicLanding />
}
