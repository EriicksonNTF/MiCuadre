"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { updateProfile } from "@/hooks/use-data"
import { Wallet, Landmark, Target, History, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  { title: "Controla tu dinero", text: "Registra ingresos, gastos y transferencias facilmente.", icon: Wallet },
  { title: "Organiza tus cuentas", text: "Maneja efectivo, bancos y tarjetas de credito.", icon: Landmark },
  { title: "Metas de ahorro", text: "Crea objetivos y monitorea tu progreso.", icon: Target },
  { title: "Historial claro", text: "Consulta todos tus movimientos con filtros.", icon: History },
  { title: "MiCuadre te ayuda", text: "Visualiza balance, deudas y proximos pagos.", icon: Sparkles },
]

export default function OnboardingPage() {
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)
  const router = useRouter()

  const finish = async () => {
    setLoading(true)
    try {
      await updateProfile({ onboarding_completed: true })
      router.replace("/")
    } finally {
      setLoading(false)
    }
  }

  const goNext = () => {
    if (index === steps.length - 1) {
      finish()
      return
    }
    setIndex((v) => v + 1)
  }

  const goPrev = () => {
    setIndex((v) => Math.max(0, v - 1))
  }

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
  }

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }

  const onTouchEnd = () => {
    const threshold = 60
    if (touchDeltaX.current <= -threshold) {
      if (index < steps.length - 1) setIndex((v) => v + 1)
    } else if (touchDeltaX.current >= threshold) {
      goPrev()
    }
    touchStartX.current = null
    touchDeltaX.current = 0
  }

  return (
    <main className="min-h-screen bg-background px-6 pt-10 pb-safe-areas flex flex-col">
      <div className="flex justify-end">
        <button onClick={finish} className="text-sm text-muted-foreground">Omitir</button>
      </div>

      <div
        className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {steps.map((item) => {
            const StepIcon = item.icon
            return (
              <section key={item.title} className="w-full shrink-0 flex flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground transition-all duration-300">
                  <StepIcon className="h-9 w-9" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{item.title}</h1>
                <p className="mt-3 max-w-xs text-sm text-muted-foreground">{item.text}</p>
              </section>
            )
          })}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-muted")} />
        ))}
      </div>

      <Button
        className="h-12 rounded-2xl"
        disabled={loading}
        onClick={goNext}
      >
        {index === steps.length - 1 ? "Listo" : "Siguiente"}
      </Button>
    </main>
  )
}
