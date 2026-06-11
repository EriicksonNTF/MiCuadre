"use client"

import { useEffect } from "react"
import { useTheme } from "@/components/providers/theme-provider"

const LIGHT = "#fafaf9"
const DARK = "#12121a"

export function ThemeColor() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute("content", resolvedTheme === "dark" ? DARK : LIGHT)
    }
  }, [resolvedTheme])

  return null
}
