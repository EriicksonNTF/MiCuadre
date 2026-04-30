"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Bell,
  BellOff,
  DollarSign,
  Globe,
  Shield,
  HelpCircle,
  LogOut,
  User,
  Smartphone,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/providers/theme-provider"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { useProfile, updateProfile } from "@/hooks/use-data"
import type { Theme, Currency } from "@/lib/types/database"

export function SettingsScreen() {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { data: profile } = useProfile()

  const [primaryCurrency, setPrimaryCurrency] = useState<Currency>("DOP")
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme)
  const [isLoadingTheme, setIsLoadingTheme] = useState(true)
  const [notifications, setNotifications] = useState({
    transactions: true,
    goals: true,
    creditAlerts: true,
    marketing: false,
  })
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (profile) {
      if (profile.preferred_currency) {
        setPrimaryCurrency(profile.preferred_currency)
      }
      if (profile.theme) {
        setCurrentTheme(profile.theme)
        setTheme(profile.theme)
      }
      setIsLoadingTheme(false)
    }
  }, [profile, setTheme])

  const handleThemeChange = async (newTheme: Theme) => {
    setCurrentTheme(newTheme)
    setTheme(newTheme)
    try {
      await updateProfile({ theme: newTheme })
    } catch (error) {
      console.error("Failed to update theme in profile:", error)
    }
  }

  const handleCurrencyChange = async (newCurrency: Currency) => {
    setPrimaryCurrency(newCurrency)
    try {
      await updateProfile({ preferred_currency: newCurrency })
    } catch (error) {
      console.error("Failed to update currency in profile:", error)
    }
  }

  const themeOptions = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const

  const currentThemeOption = themeOptions.find((t) => t.value === currentTheme)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Ajustes</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-6 pt-6">
        {/* Profile Section */}
        <Link href="/profile" className="block">
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-emerald-600">
                <User className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Usuario Demo</p>
                <p className="text-sm text-muted-foreground">demo@finwallet.app</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </Link>

        {/* Appearance Section */}
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Apariencia
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {/* Theme */}
            <button
              onClick={() => setShowThemePicker(true)}
              className="flex w-full items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {resolvedTheme === "dark" ? (
                    <Moon className="h-5 w-5 text-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-foreground" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Tema</p>
                  <p className="text-sm text-muted-foreground">
                    {currentThemeOption?.label}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="mx-4 h-px bg-border" />

            {/* Currency */}
            <button
              onClick={() => setShowCurrencyPicker(true)}
              className="flex w-full items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <DollarSign className="h-5 w-5 text-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Moneda principal</p>
                  <p className="text-sm text-muted-foreground">
                    {primaryCurrency === "DOP" ? "Peso Dominicano (RD$)" : "Dólar (US$)"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notificaciones
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {[
              {
                key: "transactions",
                label: "Transacciones",
                description: "Notificar nuevos gastos e ingresos",
              },
              {
                key: "goals",
                label: "Metas de ahorro",
                description: "Progreso y logros de metas",
              },
              {
                key: "creditAlerts",
                label: "Alertas de tarjeta",
                description: "Fechas de corte y pagos",
              },
              {
                key: "marketing",
                label: "Promociones",
                description: "Ofertas y novedades",
              },
            ].map((item, index) => (
              <div key={item.key}>
                {index > 0 && <div className="mx-4 h-px bg-border" />}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {notifications[item.key as keyof typeof notifications] ? (
                        <Bell className="h-5 w-5 text-foreground" />
                      ) : (
                        <BellOff className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications[item.key as keyof typeof notifications]}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        [item.key]: checked,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Section */}
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Otros
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {[
              { icon: Shield, label: "Seguridad", href: "/settings/security" },
              { icon: HelpCircle, label: "Ayuda y soporte", href: "/settings/help" },
              { icon: Smartphone, label: "Acerca de", href: "/settings/about" },
            ].map((item, index) => (
              <div key={item.label}>
                {index > 0 && <div className="mx-4 h-px bg-border" />}
                <Link
                  href={item.href}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <item.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <p className="font-medium text-foreground">{item.label}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Cerrar sesión</span>
        </button>

        {/* Danger Zone */}
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-600">
            Zona peligrosa
          </h2>
          <div className="overflow-hidden rounded-2xl bg-red-50/50">
            <button onClick={() => setShowDeleteAccount(true)} className="flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <p className="font-medium text-red-600">Eliminar cuenta</p>
              </div>
              <ChevronRight className="h-5 w-5 text-red-400" />
            </button>
          </div>
        </div>

        {/* Version */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          FinWallet v1.0.0
        </p>
      </div>

      {/* Theme Picker Modal - iOS optimized */}
      {showThemePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onClick={() => setShowThemePicker(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b bg-card">
              <h2 className="text-lg font-semibold">Seleccionar tema</h2>
              <button onClick={() => setShowThemePicker(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
              <div className="pb-safe-areas space-y-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <button key={option.value} onClick={() => { handleThemeChange(option.value); setShowThemePicker(false); }}
                      className={cn("flex w-full items-center gap-4 rounded-2xl p-4 transition-colors", currentTheme === option.value ? "bg-accent text-accent-foreground" : "bg-muted")}>
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currency Picker Modal - iOS optimized */}
      {showCurrencyPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onClick={() => setShowCurrencyPicker(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b bg-card">
              <h2 className="text-lg font-semibold">Moneda principal</h2>
              <button onClick={() => setShowCurrencyPicker(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
              <div className="pb-safe-areas space-y-2">
                {[{ value: "DOP", label: "Peso Dominicano", symbol: "RD$" }, { value: "USD", label: "Dólar Estadounidense", symbol: "US$" }].map((option) => (
                  <button key={option.value} onClick={() => { handleCurrencyChange(option.value as Currency); setShowCurrencyPicker(false); }}
                    className={cn("flex w-full items-center justify-between rounded-2xl p-4 transition-colors", primaryCurrency === option.value ? "bg-accent text-accent-foreground" : "bg-muted")}>
                    <span className="font-medium">{option.label}</span>
                    <span className="text-sm opacity-70">{option.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal - iOS optimized */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onClick={() => setShowLogoutConfirm(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex-none flex items-center justify-center px-5 py-6 border-b bg-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <LogOut className="h-7 w-7 text-red-600" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
              <div className="pb-safe-areas space-y-2 text-center">
                <h2 className="text-xl font-bold">¿Cerrar sesión?</h2>
                <p className="text-sm text-muted-foreground">Tu sesión se cerrará y necesitarás iniciar sesión nuevamente para acceder a tu cuenta.</p>
              </div>
            </div>
            <div className="flex-none px-5 py-4 pb-safe-areas border-t bg-card safe-area-bottom space-y-3">
              <button onClick={handleLogout} disabled={isLoggingOut}
                className="h-12 w-full rounded-xl bg-red-500 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {isLoggingOut ? "Cerrando sesión..." : "Sí, cerrar sesión"}
              </button>
              <button onClick={() => setShowLogoutConfirm(false)}
                className="h-12 w-full rounded-xl bg-muted text-base font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal - iOS optimized */}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onClick={() => setShowDeleteAccount(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b bg-card">
              <div className="w-9" />
              <h2 className="text-lg font-semibold">Eliminar cuenta?</h2>
              <button onClick={() => setShowDeleteAccount(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
              <div className="pb-safe-areas space-y-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mx-auto mb-4">
                  <Trash2 className="h-7 w-7 text-red-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta acción es permanente. Todos tus datos, transacciones, metas y cuentas serán eliminados para siempre y no podrán ser recuperados.
                </p>
              </div>
            </div>
            <div className="flex-none px-5 py-4 pb-safe-areas border-t bg-card safe-area-bottom space-y-3">
              <button onClick={() => {
                alert("Función próximamente")
                setShowDeleteAccount(false)
              }}
                className="h-12 w-full rounded-xl bg-red-500 text-base font-semibold text-white hover:bg-red-600">
                Eliminar cuenta
              </button>
              <button onClick={() => setShowDeleteAccount(false)}
                className="h-12 w-full rounded-xl bg-muted text-base font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
