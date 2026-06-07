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
  SlidersHorizontal,
} from "lucide-react"
import { useTheme } from "@/components/providers/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { createClient } from "@/lib/supabase/client"
import { useProfile, updateProfile } from "@/hooks/use-data"
import { isPasskeyEnabled, verifyPasskeyUnlock } from "@/lib/passkey"
import { setPreferredCurrency } from "@/lib/data"
import type { Theme, Currency } from "@/lib/types/database"
import { useEntitlements } from "@/hooks/use-entitlements"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { PushNotificationCard } from "@/components/pwa/push-notification-card"
import { useBillingStatus } from "@/hooks/use-billing-status"
import { isPaidPlan } from "@/lib/billing/plans"
import { notify } from "@/lib/notifications"
import { SettingsGroup } from "@/components/settings/settings-group"
import { SettingsRow } from "@/components/settings/settings-row"
import { SettingsSectionLabel } from "@/components/settings/settings-section-label"
import { PlanCard, PlanCardActions } from "@/components/settings/plan-card"

const QA_EMAIL = "example@example.com"

const THEME_OPTIONS = [
  { value: "light" as const, label: "Claro", icon: Sun },
  { value: "dark" as const, label: "Oscuro", icon: Moon },
  { value: "system" as const, label: "Sistema", icon: Monitor },
] as const

const CURRENCY_OPTIONS = [
  { value: "DOP" as const, label: "Peso Dominicano", symbol: "RD$" },
  { value: "USD" as const, label: "Dólar Estadounidense", symbol: "US$" },
] as const

const LANGUAGE_OPTIONS = [
  { value: "es" as const, label: "Español" },
  { value: "en" as const, label: "English" },
] as const

const PLAN_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  unpaid: "Pago pendiente",
  canceled: "Cancelado",
  incomplete: "Pendiente",
}

export function SettingsScreen() {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { plan, canExport } = useEntitlements()
  const { data: billingStatus, mutate: refreshBillingStatus } = useBillingStatus()

  const [showDebugQa, setShowDebugQa] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [primaryCurrency, setPrimaryCurrency] = useState<Currency>("DOP")
  const [currentLanguage, setCurrentLanguage] = useState<"es" | "en">("es")
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme)
  const [isLoadingTheme, setIsLoadingTheme] = useState(true)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [showPlanSelector, setShowPlanSelector] = useState(false)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [isVerifyingPlan, setIsVerifyingPlan] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("")
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then((res) => {
      setAuthEmail(res.data?.user?.email?.toLowerCase() ?? null)
    })
  }, [])

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
      if (profile.language) {
        setCurrentLanguage(profile.language === "en" ? "en" : "es")
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

  const handleLanguageChange = async (newLanguage: "es" | "en") => {
    setCurrentLanguage(newLanguage)
    try {
      await updateProfile({ language: newLanguage })
    } catch (error) {
      console.error("Failed to update language in profile:", error)
    }
  }

  const currentThemeOption = THEME_OPTIONS.find((t) => t.value === currentTheme)
  const canManagePlan = isPaidPlan(plan) || Boolean(billingStatus?.billingReady)
  const billingPlanStatus = (billingStatus?.planStatus ||
    profile?.plan_status ||
    "active") as
    | "active"
    | "trialing"
    | "past_due"
    | "unpaid"
    | "canceled"
    | "incomplete"
  const readablePlanStatus = PLAN_STATUS_LABELS[billingPlanStatus] || "Activo"

  const openBillingPortal = async () => {
    setIsOpeningPortal(true)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const data = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null
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

  const exportCsv = async () => {
    setIsExportingCsv(true)
    try {
      const response = await fetch("/api/account/export", { method: "GET" })
      if (response.status === 403) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        notify({
          title: "Disponible en Pro",
          message: data?.error || "La exportación a CSV está incluida en MiCuadre Pro.",
        })
        return
      }
      if (!response.ok) {
        notify({ title: "No se pudo exportar", message: "Intenta de nuevo en unos segundos." })
        return
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = ""
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      notify({ title: "Exportación lista", message: "Tu archivo CSV se descargó correctamente." })
    } catch {
      notify({ title: "No se pudo exportar", message: "Verifica tu conexión e intenta de nuevo." })
    } finally {
      setIsExportingCsv(false)
    }
  }

  const restorePurchases = async () => {
    setIsRestoringPurchases(true)
    try {
      await refreshBillingStatus()
      notify({ title: "Compras restauradas", message: "Verificamos tu plan con el servidor." })
    } catch {
      notify({ title: "No se pudo restaurar", message: "Intenta de nuevo en unos segundos." })
    } finally {
      setIsRestoringPurchases(false)
    }
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
      setDeleteAccountError('Escribe "ELIMINAR" para confirmar.')
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
  const isDebuggable = isDevMode && !isQaUser
  const displayEmail = authEmail ?? "sin correo"

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border/55 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-4 px-5 py-4">
          <Link
            href="/"
            className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/85"
            aria-label="Volver al inicio"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" aria-hidden />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preferencias</p>
            <h1 className="text-lg font-black tracking-tight text-foreground">Ajustes</h1>
          </div>
        </div>
      </div>

      <div className="motion-list mx-auto max-w-md space-y-6 px-5 pt-6">
        <Link href="/profile" className="block">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || "Usuario"} />
                <AvatarFallback className="bg-gradient-to-br from-accent to-emerald-600 text-white">
                  <User className="h-7 w-7" aria-hidden />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {profile?.full_name || profile?.first_name || "Usuario"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {profile?.email || "Sin correo"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
          </div>
        </Link>

        <section className="space-y-3">
          <SettingsSectionLabel>Apariencia</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow
              icon={resolvedTheme === "dark" ? Moon : Sun}
              title="Tema"
              description={currentThemeOption?.label}
              onClick={() => setShowThemePicker(true)}
              disabled={isLoadingTheme}
            />
            <SettingsRow
              icon={DollarSign}
              title="Moneda principal"
              description={
                primaryCurrency === "DOP" ? "Peso Dominicano (RD$)" : "Dólar (US$)"
              }
              onClick={() => setShowCurrencyPicker(true)}
            />
            <SettingsRow
              icon={Globe}
              title="Idioma"
              description={currentLanguage === "en" ? "English" : "Español"}
              onClick={() => setShowLanguagePicker(true)}
            />
          </SettingsGroup>
        </section>

        <section className="space-y-3">
          <SettingsSectionLabel>Notificaciones</SettingsSectionLabel>
          <PushNotificationCard />
          <SettingsGroup>
            <SettingsRow
              icon={SlidersHorizontal}
              title="Preferencias"
              description="Transacciones, presupuestos, alertas y promociones"
              href="/settings/notifications"
            />
          </SettingsGroup>
        </section>

        <section className="space-y-3">
          <SettingsSectionLabel>Mi plan</SettingsSectionLabel>
          <PlanCard
            plan={plan}
            readablePlanStatus={readablePlanStatus}
            canManagePlan={canManagePlan}
            canExport={canExport}
            billingPlanStatus={billingPlanStatus}
            onOpenPlanSelector={() => setShowPlanSelector(true)}
            onOpenBillingPortal={openBillingPortal}
            onVerifyPlan={verifyPlan}
            onExportCsv={exportCsv}
            onRestorePurchases={restorePurchases}
            isOpeningPortal={isOpeningPortal}
            isVerifyingPlan={isVerifyingPlan}
            isExportingCsv={isExportingCsv}
            isRestoringPurchases={isRestoringPurchases}
          />
          <PlanCardActions
            canManagePlan={canManagePlan}
            canExport={canExport}
            showVerify={
              billingPlanStatus === "past_due" ||
              billingPlanStatus === "incomplete" ||
              billingPlanStatus === "unpaid"
            }
            onOpenPlanSelector={() => setShowPlanSelector(true)}
            onOpenBillingPortal={openBillingPortal}
            onVerifyPlan={verifyPlan}
            onExportCsv={exportCsv}
            onRestorePurchases={restorePurchases}
            isOpeningPortal={isOpeningPortal}
            isVerifyingPlan={isVerifyingPlan}
            isExportingCsv={isExportingCsv}
            isRestoringPurchases={isRestoringPurchases}
          />
        </section>

        <section className="space-y-3">
          <SettingsSectionLabel>Control financiero</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow icon={BarChart3} title="Reportes" href="/settings/reports" />
            <SettingsRow icon={Repeat} title="Suscripciones" href="/settings/subscriptions" />
            <SettingsRow icon={Tags} title="Categorías" href="/settings/categories" />
          </SettingsGroup>
        </section>

        <section className="space-y-3">
          <SettingsSectionLabel>Otros</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow
              icon={Shield}
              title="Seguridad y privacidad"
              href="/settings/security-privacy"
            />
            <SettingsRow icon={Shield} title="Seguridad" href="/settings/security" />
            <SettingsRow icon={HelpCircle} title="Ayuda y soporte" href="/settings/help" />
            <SettingsRow icon={Smartphone} title="Acerca de" href="/settings/about" />
            {isQaAccessEnabled ? (
              <SettingsRow icon={TestTube2} title="QA" href="/qa" />
            ) : null}
          </SettingsGroup>
        </section>

        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive transition active:scale-[0.99]"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          <span className="font-medium">Cerrar sesión</span>
        </button>

        <section className="space-y-3">
          <h3 className="px-6 text-xs font-semibold uppercase tracking-wider text-destructive">
            Zona peligrosa
          </h3>
          <SettingsGroup divided={false} className="border-destructive/30 bg-destructive/5">
            <SettingsRow
              icon={Trash2}
              iconClassName=""
              title="Eliminar cuenta"
              onClick={() => setShowDeleteAccount(true)}
              destructive
              className="text-destructive"
            />
          </SettingsGroup>
        </section>

        {isDebuggable && !profileLoading ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Modo Debug QA (solo desarrollo)</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Correo actual: <span className="font-mono">{displayEmail}</span>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              QA esperado: <span className="font-mono">{QA_EMAIL}</span>
            </p>
            <button type="button"
              onClick={() => setShowDebugQa(true)}
              className="mt-3 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-300 dark:bg-amber-900/40 dark:text-amber-300"
            >
              Forzar mostrar QA (temporal)
            </button>
          </div>
        ) : null}

        <p className="pb-2 pt-2 text-center text-xs text-muted-foreground">MiCuadre v1.0.0</p>
      </div>

      {showThemePicker ? (
        <BaseModalForm title="Seleccionar tema" onClose={() => setShowThemePicker(false)}>
          <div role="radiogroup" aria-label="Tema" className="space-y-2 pb-2">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <button
                  type="button"
                  key={option.value}
                  role="radio"
                  aria-checked={currentTheme === option.value}
                  onClick={() => {
                    handleThemeChange(option.value)
                    setShowThemePicker(false)
                  }}
                  className={
                    currentTheme === option.value
                      ? "flex w-full items-center gap-4 rounded-2xl bg-accent p-4 text-accent-foreground"
                      : "flex w-full items-center gap-4 rounded-2xl bg-muted p-4 text-foreground"
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="font-medium">{option.label}</span>
                </button>
              )
            })}
          </div>
        </BaseModalForm>
      ) : null}

      {showCurrencyPicker ? (
        <BaseModalForm title="Moneda principal" onClose={() => setShowCurrencyPicker(false)}>
          <div role="radiogroup" aria-label="Moneda principal" className="space-y-2 pb-2">
            {CURRENCY_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                role="radio"
                aria-checked={primaryCurrency === option.value}
                onClick={() => {
                  handleCurrencyChange(option.value)
                  setShowCurrencyPicker(false)
                }}
                className={
                  primaryCurrency === option.value
                    ? "flex w-full items-center justify-between rounded-2xl bg-accent p-4 text-accent-foreground"
                    : "flex w-full items-center justify-between rounded-2xl bg-muted p-4 text-foreground"
                }
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-sm opacity-70">{option.symbol}</span>
              </button>
            ))}
          </div>
        </BaseModalForm>
      ) : null}

      {showLanguagePicker ? (
        <BaseModalForm title="Idioma" onClose={() => setShowLanguagePicker(false)}>
          <div role="radiogroup" aria-label="Idioma" className="space-y-2 pb-2">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                role="radio"
                aria-checked={currentLanguage === option.value}
                onClick={() => {
                  handleLanguageChange(option.value)
                  setShowLanguagePicker(false)
                }}
                className={
                  currentLanguage === option.value
                    ? "flex w-full items-center justify-between rounded-2xl bg-accent p-4 text-accent-foreground"
                    : "flex w-full items-center justify-between rounded-2xl bg-muted p-4 text-foreground"
                }
              >
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Más idiomas estarán disponibles próximamente.
          </p>
        </BaseModalForm>
      ) : null}

      {showLogoutConfirm ? (
        <BaseModalForm
          onClose={() => setShowLogoutConfirm(false)}
          footer={
            <div className="space-y-3">
              <button type="button" onClick={handleLogout} disabled={isLoggingOut}
                className="h-12 w-full rounded-xl bg-destructive text-base font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                {isLoggingOut ? "Cerrando sesión..." : "Sí, cerrar sesión"}
              </button>
              <button type="button" onClick={() => setShowLogoutConfirm(false)}
                className="h-12 w-full rounded-xl bg-muted text-base font-semibold">
                Cancelar
              </button>
            </div>
          }
        >
          <div className="space-y-2 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <LogOut className="h-7 w-7 text-destructive" aria-hidden />
            </div>
            <h2 className="text-xl font-bold">¿Cerrar sesión?</h2>
            <p className="text-sm text-muted-foreground">Tu sesión se cerrará y necesitarás iniciar sesión nuevamente para acceder a tu cuenta.</p>
          </div>
        </BaseModalForm>
      ) : null}

      {showDeleteAccount ? (
        <BaseModalForm
          title="Eliminar cuenta"
          onClose={() => setShowDeleteAccount(false)}
          footer={
            <div className="space-y-3">
              <button type="button" onClick={handleDeleteAccount} disabled={isDeletingAccount}
                className="h-12 w-full rounded-xl bg-destructive text-base font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                {isDeletingAccount ? "Procesando..." : "Eliminar cuenta"}
              </button>
              <button type="button" onClick={() => setShowDeleteAccount(false)}
                className="h-12 w-full rounded-xl bg-muted text-base font-semibold">
                Cancelar
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-1 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">
              Esta acción es permanente. Todos tus datos, transacciones, planificación y cuentas serán eliminados para siempre y no podrán ser recuperados.
            </p>
            <div className="text-left">
              <label htmlFor="delete-confirmation" className="mb-1 block text-xs font-medium text-muted-foreground">
                Escribe ELIMINAR para confirmar
              </label>
              <input
                id="delete-confirmation"
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground"
                placeholder="ELIMINAR"
              />
            </div>
            {deleteAccountError ? (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {deleteAccountError}
              </p>
            ) : null}
          </div>
        </BaseModalForm>
      ) : null}

      <PlanSelectorSheet open={showPlanSelector} onOpenChange={setShowPlanSelector} />
    </div>
  )
}
