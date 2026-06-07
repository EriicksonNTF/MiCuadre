"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { offlineDB } from "@/lib/offline/db"

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get initial session quickly to reduce first-paint delay
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to get session:", err)
        setError("No se pudo conectar con el servidor")
        setLoading(false)
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
          setUser(session?.user ?? null)
          setLoading(false)
        } catch (err) {
          console.error("Auth state change handler error:", err)
          setUser(session?.user ?? null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
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

