"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { offlineDB } from "@/lib/offline/db"

const AUTH_TIMEOUT = 8000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), ms)),
  ])
}

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const resolve = (sessionUser: User | null, err: string | null = null) => {
      if (cancelled) return
      setUser(sessionUser)
      setError(err)
      setLoading(false)
    }

    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT)
      .then(({ data: { session } }) => resolve(session?.user ?? null))
      .catch((err) => {
        console.error("Failed to get session:", err)
        resolve(null, "No se pudo conectar con el servidor")
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === "SIGNED_OUT" || !session) {
            try {
              await offlineDB.clearAllCaches()
            } catch (err) {
              console.error("Failed to clear offline caches on auth change:", err)
            }
          }
          resolve(session?.user ?? null)
        } catch (err) {
          console.error("Auth state change handler error:", err)
          resolve(session?.user ?? null)
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await offlineDB.clearAllCaches()
    } catch (err) {
      console.error("Failed to clear offline caches on signOut:", err)
    }
    await supabase.auth.signOut()
  }

  return {
    user,
    loading,
    error,
    signOut,
    isAuthenticated: !!user,
  }
}

