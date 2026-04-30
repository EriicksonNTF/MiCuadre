"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { Theme } from "@/lib/types/database"

type ThemeProviderContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeProviderContext = createContext<ThemeProviderContextType>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
})

interface ThemeProviderProps {
  children: React.ReactNode
  initialTheme?: Theme
  onThemeChange?: (theme: Theme) => void
}

export function ThemeProvider({ children, initialTheme, onThemeChange }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme || "system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    onThemeChange?.(newTheme)
  }, [onThemeChange])

  useEffect(() => {
    setMounted(true)
    if (initialTheme) {
      setThemeState(initialTheme)
    } else {
      const stored = localStorage.getItem("theme") as Theme | null
      if (stored) {
        setThemeState(stored)
      }
    }
  }, [initialTheme])

  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement

    const updateResolvedTheme = () => {
      let resolved: "light" | "dark" = "light"
      
      if (theme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
      } else {
        resolved = theme
      }

      setResolvedTheme(resolved)
      root.classList.remove("light", "dark")
      root.classList.add(resolved)
    }

    updateResolvedTheme()
    localStorage.setItem("theme", theme)

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "system") {
        updateResolvedTheme()
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, mounted])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
