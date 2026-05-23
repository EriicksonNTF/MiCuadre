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
  TestTube2,
  Trash2,
  BarChart3,
  Repeat,
  Tags,
  Sparkles,
  RefreshCw,
  CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/providers/theme-provider"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { createClient } from "@/lib/supabase/client"
import { useProfile, updateProfile } from "@/hooks/use-data"
import { isPasskeyEnabled, verifyPasskeyUnlock } from "@/lib/passkey"
import { setPreferredCurrency } from "@/lib/data"
import type { Theme, Currency } from "@/lib/types/database"
import { useEntitlements } from "@/hooks/use-entitlements"
import { PlanBadge } from "@/components/entitlements/plan-badge"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { useBillingStatus } from "@/hooks/use-billing-status"
import { isPaidPlan } from "@/lib/billing/plans"
import { notify } from "@/lib/notifications"

export function SettingsScreen() {
  const QA_EMAIL = "example@example.com"
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { plan, limits, usage } = useEntitlements()
  const { data: billingStatus, mutate: refreshBillingStatus } = useBillingStatus()

  const [showDebugQa, setShowDebugQa] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setAuthEmail(data.user?.email?.toLowerCase() ?? null)
    })
  }, [])

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
  const [showPlanSelector, setShowPlanSelector] = useState(false)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [isVerifyingPlan, setIsVerifyingPlan] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("")

  useEffect(() => {
    if (profile) {
      if (profile.preferred_currency) {
        setPrimaryCurrency(profile.preferred_currency)
        setPreferredCurrency(profile.preferred_currency)
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
    setPreferredCurrency(newCurrency)
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
  const planStatusLabels: Record<string, string> = {
    active: "Activo",
    trialing: "En prueba",
    past_due: "Pago pendiente",
    unpaid: "Pago pendiente",
    canceled: "Cancelado",
    incomplete: "Pendiente",
  }
  const financialSubscriptionLimit = limits.financial_subscriptions
  const canManagePlan = isPaidPlan(plan) || Boolean(billingStatus?.billingReady)
  const readablePlanStatus = planStatusLabels[billingStatus?.planStatus || profile?.plan_status || "active"] || "Activo"

  const openBillingPortal = async () => {
    setIsOpeningPortal(true)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !data?.url) {
        notify({ title: "Portal de facturación", message: "No pudimos abrir el portal de facturación." })
        return
      }
      window.location.href = data.url
    } catch {
      notify({ title: "Portal de facturación", message: "Intenta de nuevo en unos segundos." })
    } finally {
      setIsOpeningPortal(false)
    }
  }

  const verifyPlan = async () => {
    setIsVerifyingPlan(true)
    await refreshBillingStatus()
    setIsVerifyingPlan(false)
    notify({ title: "Estado verificado", message: "Tu plan se sincronizó correctamente." })
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setShowLogoutConfirm(false)
      router.replace("/login")
      router.refresh()
      setTimeout(() => {
        window.location.replace("/login")
      }, 0)
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    const keyword = deleteConfirmationText.trim().toUpperCase()
    if (keyword !== "DELETE" && keyword !== "ELIMINAR") {
      setDeleteAccountError('Escribe "DELETE" o "ELIMINAR" para confirmar.')
      return
    }

    setIsDeletingAccount(true)
    setDeleteAccountError(null)

    try {
      if (isPasskeyEnabled()) {
        await verifyPasskeyUnlock()
      }

      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "No se pudo eliminar la cuenta")
      }

      const supabase = createClient()
      await supabase.auth.signOut()

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("onboarding_completed")
      }

      setShowDeleteAccount(false)
      setDeleteConfirmationText("")
      router.replace("/login")
      router.refresh()
      setTimeout(() => {
        window.location.replace("/login")
      }, 0)
    } catch (error) {
      console.error("Delete account flow error:", error)
      setDeleteAccountError("No se pudo completar la solicitud. Intenta de nuevo.")
    } finally {
      setIsDeletingAccount(false)
    }
  }

const isDevMode = process.env.NODE_ENV === "development"
  const isQaUser = authEmail === QA_EMAIL
  const isQaAccessEnabled = (isDevMode && isQaUser) || showDebugQa

  const otherItems = [
    { icon: Shield, label: "Seguridad y privacidad", href: "/settings/security-privacy" },
    { icon: Shield, label: "Seguridad", href: "/settings/security" },
    { icon: HelpCircle, label: "Ayuda y soporte", href: "/settings/help" },
    { icon: Smartphone, label: "Acerca de", href: "/settings/about" },
    ...(isQaAccessEnabled
      ? [{ icon: TestTube2, label: "QA", href: "/qa" }]
      : []),
  ]

  const displayEmail = authEmail ?? "sin correo"
  const isDebuggable = isDevMode && !isQaUser

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
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
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || "Usuario"} />
                <AvatarFallback className="bg-gradient-to-br from-accent to-emerald-600 text-white">
                  <User className="h-7 w-7" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{profile?.full_name || profile?.first_name || "Usuario"}</p>
                <p className="text-sm text-muted-foreground">{profile?.email || "Sin correo"}</p>
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

        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mi plan</h2>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Plan actual</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Estado: {readablePlanStatus}</p>
              </div>
              <PlanBadge plan={plan} />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cuentas</span>
                  <span>{limits.max_accounts === "unlimited" ? `${usage.accounts} / ilimitado` : `${usage.accounts} / ${limits.max_accounts}`}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: limits.max_accounts === "unlimited" ? "12%" : `${Math.min(100, Math.round((usage.accounts / Math.max(1, limits.max_accounts)) * 100))}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Metas</span>
                  <span>{limits.max_goals === "unlimited" ? `${usage.goals} / ilimitado` : `${usage.goals} / ${limits.max_goals}`}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: limits.max_goals === "unlimited" ? "12%" : `${Math.min(100, Math.round((usage.goals / Math.max(1, limits.max_goals)) * 100))}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Suscripciones financieras</span>
                  <span>
                    {financialSubscriptionLimit === "unlimited" ? `${usage.subscriptions} / ilimitado` : `${usage.subscriptions} / ${financialSubscriptionLimit}`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width:
                        financialSubscriptionLimit === "unlimited"
                          ? "12%"
                          : `${Math.min(100, Math.round((usage.subscriptions / Math.max(1, financialSubscriptionLimit)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setShowPlanSelector(true)}
                className="h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition active:scale-[0.99]"
              >
                Ver planes
              </button>
              {canManagePlan && (
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={isOpeningPortal}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-bold text-foreground transition active:scale-[0.99] disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />
                  {isOpeningPortal ? "Abriendo..." : "Gestionar plan"}
                </button>
              )}
              {(billingStatus?.planStatus === "past_due" || billingStatus?.planStatus === "incomplete" || billingStatus?.planStatus === "unpaid") && (
                <button
                  type="button"
                  onClick={verifyPlan}
                  disabled={isVerifyingPlan}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-muted text-sm font-bold text-foreground transition active:scale-[0.99] disabled:opacity-60"
                >
                  <RefreshCw className={cn("h-4 w-4", isVerifyingPlan && "animate-spin")} />
                  Verificar estado
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Control financiero</h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {[
              { icon: Sparkles, label: "Mi plan", href: "/settings" },
              { icon: BarChart3, label: "Reportes", href: "/settings/reports" },
              { icon: Repeat, label: "Suscripciones", href: "/settings/subscriptions" },
              { icon: Tags, label: "Categorias", href: "/settings/categories" },
            ].map((item, index) => (
              <div key={item.label}>
                {index > 0 && <div className="mx-4 h-px bg-border" />}
                <Link href={item.href} className="flex items-center justify-between p-4">
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

        {/* Other Section */}
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Otros
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {otherItems.map((item, index) => (
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

        {/* Debug QA Panel */}
        {isDebuggable && !profileLoading && (
          <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Modo Debug QA (solo desarrollo)</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Email actual: <span className="font-mono">{displayEmail}</span>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              QA esperado: <span className="font-mono">{QA_EMAIL}</span>
            </p>
            <button
              onClick={() => setShowDebugQa(true)}
              className="mt-3 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-300 dark:bg-amber-900/40 dark:text-amber-300"
            >
              Forzar mostrar QA (temporal)
            </button>
          </div>
        )}

        {/* Version */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          FinWallet v1.0.0
        </p>
      </div>

      {/* Theme Picker Modal - iOS optimized */}
      {showThemePicker && (
        <BaseModalForm title="Seleccionar tema" onClose={() => setShowThemePicker(false)}>
          <div className="space-y-2 pb-2">
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
        </BaseModalForm>
      )}

      {/* Currency Picker Modal - iOS optimized */}
      {showCurrencyPicker && (
        <BaseModalForm title="Moneda principal" onClose={() => setShowCurrencyPicker(false)}>
          <div className="space-y-2 pb-2">
            {[{ value: "DOP", label: "Peso Dominicano", symbol: "RD$" }, { value: "USD", label: "Dólar Estadounidense", symbol: "US$" }].map((option) => (
              <button key={option.value} onClick={() => { handleCurrencyChange(option.value as Currency); setShowCurrencyPicker(false); }}
                className={cn("flex w-full items-center justify-between rounded-2xl p-4 transition-colors", primaryCurrency === option.value ? "bg-accent text-accent-foreground" : "bg-muted")}>
                <span className="font-medium">{option.label}</span>
                <span className="text-sm opacity-70">{option.symbol}</span>
              </button>
            ))}
          </div>
        </BaseModalForm>
      )}

      {/* Logout Confirmation Modal - iOS optimized */}
      {showLogoutConfirm && (
        <BaseModalForm
          onClose={() => setShowLogoutConfirm(false)}
          footer={
            <div className="space-y-3">
              <button onClick={handleLogout} disabled={isLoggingOut}
                className="h-12 w-full rounded-xl bg-red-500 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {isLoggingOut ? "Cerrando sesión..." : "Sí, cerrar sesión"}
              </button>
              <button onClick={() => setShowLogoutConfirm(false)}
                className="h-12 w-full rounded-xl bg-muted text-base font-semibold">
                Cancelar
              </button>
            </div>
          }
        >
          <div className="space-y-2 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <LogOut className="h-7 w-7 text-red-600" />
            </div>
            <h2 className="text-xl font-bold">¿Cerrar sesión?</h2>
            <p className="text-sm text-muted-foreground">Tu sesión se cerrará y necesitarás iniciar sesión nuevamente para acceder a tu cuenta.</p>
          </div>
        </BaseModalForm>
      )}

      {/* Delete Account Modal - iOS optimized */}
      {showDeleteAccount && (
        <BaseModalForm
          title="Eliminar cuenta"
          onClose={() => setShowDeleteAccount(false)}
          footer={
            <div className="space-y-3">
              <button onClick={handleDeleteAccount} disabled={isDeletingAccount}
                className="h-12 w-full rounded-xl bg-red-500 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {isDeletingAccount ? "Procesando..." : "Eliminar cuenta"}
              </button>
              <button onClick={() => setShowDeleteAccount(false)}
                className="h-12 w-full rounded-xl bg-muted text-base font-semibold">
                Cancelar
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-1 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-7 w-7 text-red-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              Esta acción es permanente. Todos tus datos, transacciones, metas y cuentas serán eliminados para siempre y no podrán ser recuperados.
            </p>
            <div className="text-left">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Escribe DELETE o ELIMINAR para confirmar
              </label>
              <input
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground"
                placeholder="DELETE"
              />
            </div>
            {deleteAccountError && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {deleteAccountError}
              </p>
            )}
          </div>
        </BaseModalForm>
      )}


      <PlanSelectorSheet open={showPlanSelector} onOpenChange={setShowPlanSelector} />
    </div>
  )
}
