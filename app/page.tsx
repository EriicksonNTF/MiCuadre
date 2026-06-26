"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { PublicLanding } from "@/components/landing/public-landing"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

const AUTH_TIMEOUT = 8000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), ms)),
  ])
}

export default function RootPage() {
  const router = useRouter()
  const [showLanding, setShowLanding] = useState(false)
  const [checking, setChecking] = useState(true)
  const resolved = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT)
      .then(({ data: { session } }) => {
        if (resolved.current) return
        resolved.current = true

        if (session) {
          router.replace("/dashboard")
          return
        }

        setChecking(false)
        setShowLanding(true)
      })
      .catch(() => {
        if (resolved.current) return
        resolved.current = true
        setChecking(false)
        setShowLanding(true)
      })
  }, [router])

  // Always render a visible loading state while checking auth.
  // Returning `null` prevents the "first paint" which triggers WebKit's
  // "Making the view blank because of a JS prompt before the first paint" protection.
  if (checking && !showLanding) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!showLanding) return null
  return <PublicLanding />
}
