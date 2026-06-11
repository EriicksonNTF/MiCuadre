"use client"

import { createClient } from "./client"

async function tryGetSession() {
  try {
    if (typeof document === "undefined") return null
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user || null
  } catch {
    return null
  }
}

export async function getAuthenticatedUser() {
  try {
    if (typeof window === "undefined") return null
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user
  } catch {
    // Network error — try reading session from local storage
  }
  return tryGetSession()
}
