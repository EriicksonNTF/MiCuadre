"use client"

import { useEffect, useRef, useState, type TouchEvent } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  CreditCard,
  Eye,
  Goal,
  Landmark,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/hooks/use-data"
import { updateProfile } from "@/hooks/use-data"
import { cn } from "@/lib/utils"
import { BILLING_COPY } from "@/lib/entitlements/entitlement-copy"
import { notify } from "@/lib/notifications"
import { ANNUAL_DISCOUNT_PERCENT, PLAN_CONFIG, PLAN_ORDER, formatPlanPrice, getBillingIntervalSuffix, isPaidPlan } from "@/lib/billing/plans"
import type { BillingInterval, PaidPlanTier } from "@/types/billing"

type StepVariant = "money" | "accounts" | "goals" | "history" | "helper"

const steps: {
  title: string
  highlight: string
  text: string
  icon: typeof Wallet
  variant: StepVariant
}[] = [
  {
    title: "Recupera el",
    highlight: "control",
    text: "Descubre en segundos en que se te va el dinero y toma mejores decisiones hoy.",
    icon: Wallet,
    variant: "money",
  },
  {
    title: "MiCuadre te",
    highlight: "entiende",
    text: "Analiza tus movimientos y te recomienda acciones claras para ahorrar mas este mes.",
    icon: Sparkles,
    variant: "helper",
  },
  {
    title: "Empieza con tu",
    highlight: "primera cuenta",
    text: "Crea tu base en un paso y recibe tu primera lectura financiera desde hoy.",
    icon: Target,
    variant: "goals",
  },
]

export default function OnboardingPage() {
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPlanSelection, setShowPlanSelection] = useState(false)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly")
  const [isLoadingCheckoutPlan, setIsLoadingCheckoutPlan] = useState<PaidPlanTier | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()

  useEffect(() => {
    if (profileLoading) return

    const onboardingCompleted = Boolean(profile?.onboarding_completed)

    if (onboardingCompleted) {
      router.replace("/dashboard")
    }
  }, [profile?.onboarding_completed, profileLoading, router])

  const finish = async () => {
    if (loading) return

    setLoading(true)

    try {
      await updateProfile({ onboarding_completed: true })
      if (typeof window !== "undefined") {
        window.localStorage.setItem("onboarding_completed", "true")
      }
      router.replace("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const startCheckout = async (targetPlan: PaidPlanTier) => {
    setIsLoadingCheckoutPlan(targetPlan)
    try {
      // 1. Mark onboarding as completed in DB and LocalStorage first
      await updateProfile({ onboarding_completed: true })
      if (typeof window !== "undefined") {
        window.localStorage.setItem("onboarding_completed", "true")
      }

      // 2. Request Stripe Checkout Session
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, interval: billingInterval }),
      })

      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !data?.url) {
        notify({ title: "Error de facturación", message: data?.error || BILLING_COPY.checkout.error })
        router.replace("/dashboard")
        return
      }

      // 3. Redirect to Stripe
      window.location.href = data.url
    } catch {
      notify({ title: "Error de facturación", message: BILLING_COPY.checkout.error })
      router.replace("/dashboard")
    } finally {
      setIsLoadingCheckoutPlan(null)
    }
  }

  const goNext = () => {
    if (loading) return

    if (index === steps.length - 1) {
      setShowPlanSelection(true)
      return
    }

    setIndex((value) => value + 1)
  }

  const goPrev = () => {
    if (loading) return
    setIndex((value) => Math.max(0, value - 1))
  }

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX
    touchDeltaX.current = 0
  }

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return
    touchDeltaX.current = event.touches[0].clientX - touchStartX.current
  }

  const onTouchEnd = () => {
    const threshold = 60

    if (touchDeltaX.current <= -threshold && index < steps.length - 1) {
      setIndex((value) => value + 1)
    }

    if (touchDeltaX.current >= threshold) {
      goPrev()
    }

    touchStartX.current = null
    touchDeltaX.current = 0
  }

  const currentStep = steps[index]
  const StepIcon = currentStep.icon

  if (showPlanSelection) {
    return (
      <main className="min-h-screen overflow-y-auto bg-background text-foreground pb-8">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-safe-areas pt-safe-areas">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="overflow-hidden rounded-full border border-border/60 shadow-sm">
                <Image src="/icono-favicon.png" alt="MiCuadre" width={44} height={44} className="h-11 w-11 object-cover" />
              </div>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground">
                  Paso opcional
                </p>
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  Elige tu plan
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={finish}
              disabled={loading}
              className="rounded-full px-3 py-2 text-sm font-medium text-green-700 transition active:scale-95 disabled:opacity-50"
            >
              Saltar
            </button>
          </header>

          <div className="text-center py-4 mt-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Comienza con el plan ideal
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
              Prueba la potencia de Pro desde hoy o empieza gratis. Cancela cuando quieras.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-1.5">
            <div className="grid grid-cols-2 gap-1">
              {(["monthly", "yearly"] as BillingInterval[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBillingInterval(value)}
                  className={cn(
                    "h-10 rounded-xl text-xs font-bold transition-all duration-300 active:scale-[0.98]",
                    billingInterval === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {value === "monthly" ? "Mensual" : `Anual · Ahorra ${ANNUAL_DISCOUNT_PERCENT}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 my-2">
            {PLAN_ORDER.map((tier) => {
              const plan = PLAN_CONFIG[tier]
              const paid = isPaidPlan(tier)
              return (
                <div
                  key={tier}
                  className={cn(
                    "rounded-2xl border bg-card p-5 relative overflow-hidden",
                    tier === "pro" && "border-primary/45 bg-gradient-to-b from-card via-card to-primary/[0.03] shadow-[0_4px_20px_rgba(34,197,94,0.08)]",
                  )}
                >
                  {tier === "pro" && (
                    <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-primary/10 blur-2xl -mr-4 -mt-4 pointer-events-none" />
                  )}
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-base font-extrabold text-foreground">MiCuadre {plan.label}</h3>
                        {plan.badge && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", tier === "pro" ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{plan.audience}</p>
                      <p className="mt-2.5 text-base font-black text-foreground">
                        {formatPlanPrice(tier, billingInterval)}
                        <span className="text-xs font-semibold text-muted-foreground">{getBillingIntervalSuffix(billingInterval)}</span>
                      </p>
                      {paid && billingInterval === "yearly" && (
                        <p className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Equivale a ${plan.price.yearlyMonthlyEquivalent.toFixed(2)}/mes
                        </p>
                      )}
                    </div>
                    <div className={cn("rounded-full p-1.5 border", tier === "pro" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/60 text-muted-foreground border-border/10")}>
                      {tier === "free" ? <Wallet className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </div>
                  </div>
                  <ul className="relative mt-3.5 space-y-1.5 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
                    {plan.benefits.slice(0, 4).map((benefit) => (
                      <li key={benefit} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="relative mt-4">
                    <button
                      type="button"
                      onClick={() => paid ? startCheckout(tier as PaidPlanTier) : finish()}
                      disabled={loading || isLoadingCheckoutPlan !== null}
                      className={cn(
                        "h-10 w-full rounded-xl text-xs font-bold active:scale-[0.99] transition duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60",
                        paid ? "bg-primary text-primary-foreground hover:opacity-95 shadow-md shadow-primary/10" : "bg-muted/70 hover:bg-muted text-foreground"
                      )}
                    >
                      {isLoadingCheckoutPlan === tier ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Iniciando pago seguro...
                        </>
                      ) : paid ? plan.cta : "Comenzar gratis"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-xl bg-muted/20 border border-border/40 p-4 space-y-2 text-center text-[10px] text-muted-foreground">
            <p className="font-semibold text-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Pago seguro vía Stripe
            </p>
          <p>Tus datos de pago están protegidos por Stripe. Cancela cuando quieras desde tu perfil.</p>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={finish}
              disabled={loading}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition underline underline-offset-4 animate-fade-in"
            >
              Saltar y comenzar gratis por ahora
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-safe-areas pt-safe-areas">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-full border border-border/60 shadow-sm">
              <Image src="/icono-favicon.png" alt="MiCuadre" width={44} height={44} className="h-11 w-11 object-cover" />
            </div>

            <div>
              <p className="text-[10px] font-medium text-muted-foreground">
                Tu copiloto financiero dominicano
              </p>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                MiCuadre
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={finish}
            disabled={loading}
            className="rounded-full px-3 py-2 text-sm font-medium text-green-700 transition active:scale-95 disabled:opacity-50"
          >
            Omitir
          </button>
        </header>

        <section
          className="relative mt-6 flex flex-1 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {steps.map((step, stepIndex) => (
              <article
                key={step.title + step.highlight}
                className="flex w-full shrink-0 flex-col"
              >
                <div className="flex flex-1 flex-col items-center justify-center">
                  <VisualMockup variant={step.variant} active={stepIndex === index} />

                  <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700 shadow-sm">
                    <step.icon className="h-5 w-5" />
                  </div>

                  <div className="mt-5 text-center">
                    <h2 className="text-[26px] font-bold tracking-tight text-foreground">
                      {stepIndex + 1}. {step.title}{" "}
                      <span className="text-green-700">{step.highlight}</span>
                    </h2>

                    <p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              aria-label={`Ir al paso ${dotIndex + 1}`}
              onClick={() => setIndex(dotIndex)}
              disabled={loading}
              className={cn(
                "h-2 rounded-full transition-all duration-300 disabled:opacity-50",
                dotIndex === index
                  ? "w-6 bg-green-700"
                  : "w-2 bg-muted hover:bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <Button
          type="button"
          disabled={loading}
          onClick={goNext}
          className="h-14 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-black/10 transition active:scale-[0.98]"
        >
          <span>
            {loading
              ? "Guardando..."
              : index === steps.length - 1
                ? "Ver mi primer plan"
                : "Continuar"}
          </span>
          {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
        </Button>
      </div>
    </main>
  )
}

function VisualMockup({
  variant,
  active,
}: {
  variant: StepVariant
  active: boolean
}) {
  return (
    <div
      className={cn(
        "relative flex h-[330px] w-full items-center justify-center transition-all duration-500",
        active ? "scale-100 opacity-100" : "scale-95 opacity-60"
      )}
    >
      <div className="absolute h-64 w-64 rounded-full bg-green-100/60 blur-2xl" />
      <div className="absolute h-44 w-44 translate-x-12 translate-y-10 rounded-full bg-muted/70 blur-xl" />

      {variant === "money" && <MoneyVisual />}
      {variant === "accounts" && <AccountsVisual />}
      {variant === "goals" && <GoalsVisual />}
      {variant === "history" && <HistoryVisual />}
      {variant === "helper" && <HelperVisual />}
    </div>
  )
}

function MoneyVisual() {
  return (
    <div className="relative w-full max-w-[280px]">
      <div className="rounded-3xl bg-card p-6 shadow-xl shadow-black/5 ring-1 ring-border">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Balance neto
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              RD$3,000
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Efectivo y débito
            </p>
          </div>

          <Eye className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="mt-8 flex h-20 items-end gap-2">
          {[32, 44, 38, 56, 48, 64, 58, 78].map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-full bg-green-600/15"
              style={{ height: `${height}%` }}
            >
              <div className="h-full rounded-full bg-green-600/70" />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-8 -left-3 rounded-2xl bg-card p-4 shadow-lg shadow-black/5 ring-1 ring-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="text-sm font-bold text-foreground">RD$5,000</p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 -right-3 rounded-2xl bg-card p-4 shadow-lg shadow-black/5 ring-1 ring-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="text-sm font-bold text-foreground">RD$2,000</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountsVisual() {
  return (
    <div className="relative w-full max-w-[280px] space-y-3">
      <AccountCard
        title="Efectivo"
        subtitle="Disponible"
        amount="RD$2,980"
        icon={Banknote}
        className="bg-green-600 text-white"
        iconClassName="bg-white/20 text-white"
      />

      <AccountCard
        title="Cuenta de banco"
        subtitle="Disponible"
        amount="RD$5,420"
        icon={Landmark}
        className="bg-card text-foreground"
        iconClassName="bg-blue-50 text-blue-600"
      />

      <AccountCard
        title="Tarjeta de crédito"
        subtitle="Deuda actual"
        amount="RD$1,250"
        icon={CreditCard}
        className="bg-primary text-primary-foreground"
        iconClassName="bg-white/10 text-white"
      />
    </div>
  )
}

function AccountCard({
  title,
  subtitle,
  amount,
  icon: Icon,
  className,
  iconClassName,
}: {
  title: string
  subtitle: string
  amount: string
  icon: typeof Wallet
  className?: string
  iconClassName?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl p-4 shadow-lg shadow-black/5 ring-1 ring-black/5",
        className
      )}
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs opacity-70">{subtitle}</p>
        <p className="mt-2 text-lg font-bold">{amount}</p>
      </div>

      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          iconClassName
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
}

function GoalsVisual() {
  return (
    <div className="relative w-full max-w-[280px]">
      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-card shadow-xl shadow-black/5 ring-1 ring-border">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-muted">
          <div className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-green-700 border-r-green-700 border-b-green-700 rotate-45" />
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">75%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Meta alcanzada
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-card p-4 shadow-xl shadow-black/5 ring-1 ring-border">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
            <Goal className="h-7 w-7" />
          </div>

          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Viaje a Cancún</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Meta: RD$5,000
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ahorrado:{" "}
              <span className="font-semibold text-green-700">RD$3,750</span>
            </p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 left-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-green-50 text-green-700 shadow-lg shadow-black/5">
        <PiggyBank className="h-9 w-9" />
      </div>
    </div>
  )
}

function HistoryVisual() {
  return (
    <div className="w-full max-w-[290px] rounded-3xl bg-card p-4 shadow-xl shadow-black/5 ring-1 ring-border">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Movimientos</p>

        <button
          type="button"
          className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground"
        >
          Mes actual
        </button>
      </div>

      <div className="space-y-1">
        <MovementRow
          title="Supermercado"
          subtitle="Hoy"
          amount="-RD$320"
          icon={ShoppingCart}
          iconClassName="bg-green-50 text-green-700"
        />
        <MovementRow
          title="Transferencia"
          subtitle="Ayer"
          amount="+RD$850"
          positive
          icon={TrendingUp}
          iconClassName="bg-green-50 text-green-700"
        />
        <MovementRow
          title="Restaurante"
          subtitle="Ayer"
          amount="-RD$150"
          icon={Utensils}
          iconClassName="bg-red-50 text-red-500"
        />
        <MovementRow
          title="Salario"
          subtitle="3 may 2026"
          amount="+RD$2,500"
          positive
          icon={Banknote}
          iconClassName="bg-green-50 text-green-700"
        />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">Ver todos los movimientos</p>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  )
}

function MovementRow({
  title,
  subtitle,
  amount,
  positive = false,
  icon: Icon,
  iconClassName,
}: {
  title: string
  subtitle: string
  amount: string
  positive?: boolean
  icon: typeof Wallet
  iconClassName?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          iconClassName
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>

      <p
        className={cn(
          "text-xs font-bold",
          positive ? "text-green-700" : "text-foreground"
        )}
      >
        {amount}
      </p>
    </div>
  )
}

function HelperVisual() {
  return (
    <div className="w-full max-w-[285px] space-y-3">
      <HelperCard
        title="Balance neto"
        amount="RD$3,000"
        subtitle="Activos menos deudas"
        icon={TrendingUp}
        iconClassName="text-green-700"
      />

      <HelperCard
        title="Deudas"
        amount="RD$1,250"
        subtitle="2 activas"
        icon={CreditCard}
        iconClassName="text-red-500"
      />

      <HelperCard
        title="Próximos pagos"
        amount="RD$850"
        subtitle="3 pendientes"
        icon={CalendarDays}
        iconClassName="text-muted-foreground"
      />

      <div className="rounded-3xl bg-green-50 p-4 ring-1 ring-green-100">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <p className="text-sm font-bold text-foreground">
              MiCuadre te acompaña
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Te ayuda a tomar mejores decisiones financieras.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function HelperCard({
  title,
  amount,
  subtitle,
  icon: Icon,
  iconClassName,
}: {
  title: string
  amount: string
  subtitle: string
  icon: typeof Wallet
  iconClassName?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-3xl bg-card p-4 shadow-lg shadow-black/5 ring-1 ring-border">
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-1 text-xl font-bold text-foreground">{amount}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      </div>

      <Icon className={cn("h-7 w-7", iconClassName)} />
    </div>
  )
}
