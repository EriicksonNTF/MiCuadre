"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AppSplash } from "@/components/dashboard/app-splash"

export function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "authenticated" | "unauthenticated">("loading")
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState("authenticated")
      } else {
        setState("unauthenticated")
        router.replace("/auth/login")
      }
    })
  }, [router])

  if (state === "loading") return <AppSplash />
  if (state === "unauthenticated") return null
  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "public" | "authenticated">("loading")
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState("authenticated")
        router.replace("/dashboard")
      } else {
        setState("public")
      }
    })
  }, [router])

  if (state === "loading") return null
  if (state === "authenticated") return null
  return <>{children}</>
}
