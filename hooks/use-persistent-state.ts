"use client"

import { useEffect, useState } from "react"

export function usePersistentState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(key)
    if (!raw) return
    try {
      setValue(JSON.parse(raw) as T)
    } catch {
      setValue(defaultValue)
    }
  }, [defaultValue, key])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
