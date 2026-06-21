"use client"

import { useState, useEffect } from "react"

export function usePersistentState<T>(key: string, defaultValue: T) {
  // React 19: Lazy initializer - reads localStorage only once on mount
  // Avoids flash of default value followed by re-render from useEffect
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue
    const raw = window.localStorage.getItem(key)
    if (!raw) return defaultValue
    try {
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
