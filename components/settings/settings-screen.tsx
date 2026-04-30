"use client"

import { useState } from "react"
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

type Currency = "DOP" | "USD"

export function SettingsScreen() {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [primaryCurrency, setPrimaryCurrency] = useState<Currency>("DOP")
  const [notifications, setNotifications] = useState({
    transactions: true,
    goals: true,
    creditAlerts: true,
    marketing: false,
  })
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const themeOptions = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const

  const currentThemeOption = themeOptions.find((t) => t.value === theme)

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
              { icon: Shield, label: "Seguridad", href: "#" },
              { icon: HelpCircle, label: "Ayuda y soporte", href: "#" },
              { icon: Smartphone, label: "Acerca de", href: "#" },
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
            <button className="flex w-full items-center justify-between p-4">
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

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setShowThemePicker(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">
              Seleccionar tema
            </h2>
            <div className="mt-4 space-y-2">
              {themeOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setTheme(option.value)
                      setShowThemePicker(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl p-4 transition-colors",
                      theme === option.value
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Currency Picker Modal */}
      {showCurrencyPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setShowCurrencyPicker(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">
              Moneda principal
            </h2>
            <div className="mt-4 space-y-2">
              {[
                { value: "DOP", label: "Peso Dominicano", symbol: "RD$" },
                { value: "USD", label: "Dólar Estadounidense", symbol: "US$" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setPrimaryCurrency(option.value as Currency)
                    setShowCurrencyPicker(false)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl p-4 transition-colors",
                    primaryCurrency === option.value
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-sm opacity-70">{option.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-100">
              <LogOut className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mt-4 text-center text-xl font-bold text-foreground">
              ¿Cerrar sesión?
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Tu sesión se cerrará y necesitarás iniciar sesión nuevamente para acceder a tu cuenta.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-12 w-full rounded-2xl bg-red-500 text-base font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {isLoggingOut ? "Cerrando sesión..." : "Sí, cerrar sesión"}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="h-12 w-full rounded-2xl bg-muted text-base font-semibold text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
