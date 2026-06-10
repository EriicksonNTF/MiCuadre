"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AppSplash } from "@/components/dashboard/app-splash"

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/dashboard"

    if (!code) {
      setError("missing_code")
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError("oauth_exchange_failed")
      } else {
        const destination = next.startsWith("/") ? next : "/dashboard"
        router.replace(destination)
      }
    })
  }, [searchParams, router])

  if (error) {
    router.replace("/auth/error?reason=" + error)
    return null
  }

  return <AppSplash />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AppSplash />}>
      <CallbackHandler />
    </Suspense>
  )
}
