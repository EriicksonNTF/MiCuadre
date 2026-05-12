"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Plus, Target, TrendingUp, Wallet } from "lucide-react"

type ActivationStep = {
  id: string
  label: string
  description: string
  href: string
  icon: typeof Wallet
}

const steps: ActivationStep[] = [
  {
    id: "account",
    label: "Agrega tu cuenta",
    description: "Comienza con efectivo o banco para rastrear tu dinero",
    href: "/accounts",
    icon: Wallet,
  },
  {
    id: "transaction",
    label: "Registra un movimiento",
    description: "Agrega un gasto o ingreso para ver tu actividad",
    href: "/expense",
    icon: TrendingUp,
  },
  {
    id: "goal",
    label: "Crea tu primera meta",
    description: "Fija un objetivo de ahorro para mantenerte motivado",
    href: "/goals",
    icon: Target,
  },
]

const STORAGE_KEY = "activation_step_completed"

function getCompletedSteps(): string[] {
  if (typeof window === "undefined") return []
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
}

function markStepCompleted(stepId: string) {
  if (typeof window === "undefined") return
  const completed = getCompletedSteps()
  if (!completed.includes(stepId)) {
    completed.push(stepId)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  }
}

function clearCompletedSteps() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function ActivationPanel() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCompletedSteps(getCompletedSteps())
  }, [])

  const completedCount = completedSteps.length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  const allDone = completedCount === steps.length

  if (!mounted) return null

  if (allDone) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-green-200 bg-green-50/60 p-5 dark:border-green-900/30 dark:bg-green-900/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Activación completada</p>
            <p className="text-xs text-muted-foreground">Ya sabes todo lo que MiCuadre puede hacer por ti.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-green-200 dark:bg-green-900/50">
            <div className="h-full rounded-full bg-green-500" style={{ width: "100%" }} />
          </div>
          <span className="text-xs font-medium text-green-700 dark:text-green-400">3/3</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-green-200 bg-green-50/40 p-5 dark:border-green-900/30 dark:bg-green-900/10">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
          Primeros pasos
        </p>
        <h3 className="mt-1 text-base font-bold text-foreground">
          {completedCount === 0
            ? "Comienza tu camino financiero"
            : "Sigue avanzando"}
        </h3>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-green-200 dark:bg-green-900/50">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-green-700 dark:text-green-400">
            {completedCount}/3 completado
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id)
          const isNext = completedCount === index

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isNext
                    ? "bg-green-600 text-white animate-pulse"
                    : "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isCompleted ? "text-green-600 dark:text-green-400 line-through" : "text-foreground"}`}>
                  {step.label}
                </p>
                {isNext && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>

              <Link
                href={step.href}
                onClick={() => {
                  if (!isCompleted) {
                    setTimeout(() => {
                      markStepCompleted(step.id)
                      setCompletedSteps(getCompletedSteps())
                    }, 500)
                  }
                }}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                  isCompleted
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : isNext
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? "Hecho" : isNext ? "Ir" : "Ver"}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { markStepCompleted, clearCompletedSteps, getCompletedSteps }