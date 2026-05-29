"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  PiggyBank,
  Plus,
  ReceiptText,
  Sparkles,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlanSelectorSheet } from "@/components/billing/plan-selector-sheet"
import { updateProfile, useProfile } from "@/hooks/use-data"
import { cn } from "@/lib/utils"

type OnboardingStep = {
  title: string
  subtitle: string
  icon: typeof Wallet
  visual: "welcome" | "transactions" | "planning" | "ready"
}

const steps: OnboardingStep[] = [
  {
    title: "Bienvenido a MiCuadre",
    subtitle: "Controla tus cuentas, gastos, tarjetas y pagos desde un solo lugar.",
    icon: Wallet,
    visual: "welcome",
  },
  {
    title: "Registra tus movimientos",
    subtitle: "Agrega ingresos y gastos, incluso cuando no tengas conexión.",
    icon: ReceiptText,
    visual: "transactions",
  },
  {
    title: "Planificación Pro",
    subtitle: "Organiza presupuestos, deudas, suscripciones y pagos próximos.",
    icon: Sparkles,
    visual: "planning",
  },
  {
    title: "Todo listo",
    subtitle: "Empieza agregando tu primera cuenta.",
    icon: CheckCircle2,
    visual: "ready",
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)

  useEffect(() => {
    if (!profileLoading && profile?.onboarding_completed) {
      router.replace("/dashboard")
    }
  }, [profile?.onboarding_completed, profileLoading, router])

  const completeOnboarding = async (destination: "/dashboard" | "/accounts") => {
    if (saving) return
    setSaving(true)
    try {
      await updateProfile({ onboarding_completed: true })
      window.localStorage.setItem("onboarding_completed", "true")
      router.replace(destination)
    } finally {
      setSaving(false)
    }
  }

  const next = () => {
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  const currentStep = steps[stepIndex]
  const StepIcon = currentStep.icon

  if (profileLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Image src="/icono-favicon.png" alt="MiCuadre" width={42} height={42} className="rounded-2xl border border-border bg-card shadow-sm" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">MiCuadre</p>
              <p className="text-sm font-bold text-foreground">Inicio guiado</p>
            </div>
          </div>

          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => completeOnboarding("/dashboard")}
              disabled={saving}
              className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              Saltar
            </button>
          ) : null}
        </header>

        <section className="flex flex-1 flex-col justify-center py-4">
          <div className="rounded-[2rem] border border-border bg-card p-4 shadow-sm">
            <OnboardingVisual variant={currentStep.visual} />
          </div>

          <div className="mt-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <StepIcon className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{currentStep.title}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{currentStep.subtitle}</p>
          </div>

          <div className="mt-6 flex items-center gap-2">
            {steps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                aria-label={`Ir al paso ${index + 1}`}
                onClick={() => setStepIndex(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === stepIndex ? "w-8 bg-primary" : "w-2 bg-muted"
                )}
              />
            ))}
          </div>
        </section>

        <footer className="space-y-3">
          {stepIndex === 0 ? (
            <Button type="button" onClick={next} className="h-13 w-full rounded-2xl text-base font-bold">
              Comenzar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : null}

          {stepIndex === 1 ? (
            <Button type="button" onClick={next} className="h-13 w-full rounded-2xl text-base font-bold">
              Continuar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : null}

          {stepIndex === 2 ? (
            <>
              <Button type="button" onClick={() => setPlansOpen(true)} className="h-13 w-full rounded-2xl text-base font-bold">
                Ver planes
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={() => completeOnboarding("/dashboard")} disabled={saving} className="h-12 rounded-2xl">
                  Saltar por ahora
                </Button>
                <Button type="button" variant="secondary" onClick={next} className="h-12 rounded-2xl">
                  Continuar
                </Button>
              </div>
            </>
          ) : null}

          {stepIndex === 3 ? (
            <>
              <Button type="button" onClick={() => completeOnboarding("/accounts")} disabled={saving} className="h-13 w-full rounded-2xl text-base font-bold">
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                Agregar cuenta
              </Button>
              <Button type="button" variant="outline" onClick={() => completeOnboarding("/dashboard")} disabled={saving} className="h-12 w-full rounded-2xl">
                Ir al inicio
              </Button>
            </>
          ) : null}
        </footer>
      </div>

      <PlanSelectorSheet
        open={plansOpen}
        onOpenChange={setPlansOpen}
        welcome
        reasonTitle="Planificación Pro"
        reasonBody="Presupuestos, calendario financiero, deudas y automatizaciones cuando necesites más control."
      />
    </main>
  )
}

function OnboardingVisual({ variant }: { variant: OnboardingStep["visual"] }) {
  if (variant === "welcome") return <WelcomeVisual />
  if (variant === "transactions") return <TransactionsVisual />
  if (variant === "planning") return <PlanningVisual />
  return <ReadyVisual />
}

function WelcomeVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
        <p className="text-xs opacity-75">Balance total</p>
        <p className="mt-1 text-3xl font-black">RD$ 42,850</p>
        <p className="mt-2 text-xs opacity-80">Cuentas, tarjetas y pagos en una vista.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MiniMetric label="Cuentas" value="3 activas" icon={Landmark} />
        <MiniMetric label="Tarjetas" value="1 al día" icon={CreditCard} />
      </div>
    </div>
  )
}

function TransactionsVisual() {
  return (
    <div className="space-y-3">
      {[
        { title: "Ingreso nómina", amount: "+RD$ 58,000", tone: "text-emerald-600" },
        { title: "Supermercado", amount: "-RD$ 3,240", tone: "text-foreground" },
        { title: "Pago tarjeta", amount: "-RD$ 12,000", tone: "text-foreground" },
      ].map((item) => (
        <div key={item.title} className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">Sincronizado</p>
            </div>
          </div>
          <p className={cn("text-sm font-black", item.tone)}>{item.amount}</p>
        </div>
      ))}
    </div>
  )
}

function PlanningVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold text-foreground">Presupuesto comida</span>
          <span className="text-muted-foreground">77%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background">
          <div className="h-full w-[77%] rounded-full bg-primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MiniMetric label="Próximos pagos" value="3" icon={CalendarDays} />
        <MiniMetric label="Deudas" value="RD$ 92k" icon={PiggyBank} />
      </div>
    </div>
  )
}

function ReadyVisual() {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <p className="mt-4 text-lg font-black text-foreground">Tu espacio está listo</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Agrega tu primera cuenta para empezar con balances claros desde hoy.</p>
    </div>
  )
}

function MiniMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Wallet }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black text-foreground">{value}</p>
    </div>
  )
}
