"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { Theme } from "@/lib/types/database"

const STORAGE_KEY = "micuadre-theme"

function getStoredTheme(): Theme | null {
  try {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
    return null
  } catch {
    return null
  }
}

function setStoredTheme(theme: Theme) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, theme)
    }
  } catch {
    // localStorage no disponible (incógnito, SSR)
  }
}

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
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() || initialTheme || "system"
  })
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    setStoredTheme(newTheme)
    onThemeChange?.(newTheme)
  }, [onThemeChange])

  const [prevInitialTheme, setPrevInitialTheme] = useState(initialTheme)
  if (!mounted) {
    setMounted(true)
  }
  if (initialTheme && initialTheme !== prevInitialTheme) {
    setPrevInitialTheme(initialTheme)
    setThemeState(initialTheme)
    setStoredTheme(initialTheme)
  }

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
