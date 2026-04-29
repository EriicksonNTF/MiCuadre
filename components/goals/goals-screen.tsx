"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Target,
  Plus,
  Plane,
  Home,
  Car,
  Smartphone,
  GraduationCap,
  Heart,
  Sparkles,
  X,
  ChevronRight,
  TrendingUp,
  Wallet,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/data"

type SavingsGoal = {
  id: string
  name: string
  icon: typeof Target
  color: string
  targetAmount: number
  currentAmount: number
  targetDate: string
}

const initialGoals: SavingsGoal[] = [
  {
    id: "1",
    name: "Fondo de emergencia",
    icon: Heart,
    color: "from-rose-500 to-pink-500",
    targetAmount: 100000,
    currentAmount: 45000,
    targetDate: "Diciembre 2024",
  },
  {
    id: "2",
    name: "Viaje a Punta Cana",
    icon: Plane,
    color: "from-blue-500 to-cyan-500",
    targetAmount: 35000,
    currentAmount: 12500,
    targetDate: "Agosto 2024",
  },
  {
    id: "3",
    name: "iPhone nuevo",
    icon: Smartphone,
    color: "from-violet-500 to-purple-500",
    targetAmount: 75000,
    currentAmount: 30000,
    targetDate: "Octubre 2024",
  },
]

const goalIcons = [
  { icon: Target, label: "General" },
  { icon: Plane, label: "Viaje" },
  { icon: Home, label: "Casa" },
  { icon: Car, label: "Vehículo" },
  { icon: Smartphone, label: "Tecnología" },
  { icon: GraduationCap, label: "Educación" },
  { icon: Heart, label: "Emergencia" },
  { icon: Sparkles, label: "Lujo" },
]

export function GoalsScreen() {
  const [goals] = useState<SavingsGoal[]>(initialGoals)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showAddMoney, setShowAddMoney] = useState<string | null>(null)
  const [addAmount, setAddAmount] = useState("")

  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0)

  const handleAddMoney = () => {
    // In real app, this would update state/backend
    setShowAddMoney(null)
    setAddAmount("")
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="px-6 pb-4 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Metas de ahorro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu progreso hacia tus sueños
        </p>
      </header>

      {/* Total Progress Card */}
      <div className="px-6 pt-2">
        <div className="rounded-3xl bg-gradient-to-br from-accent to-emerald-600 p-6 text-white">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 opacity-80" />
            <span className="text-sm font-medium opacity-80">Total ahorrado</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(totalSaved)}</p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm opacity-80">
              <span>Meta total: {formatCurrency(totalTarget)}</span>
              <span>{Math.round((totalSaved / totalTarget) * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${(totalSaved / totalTarget) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="mt-8 px-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Tus metas</p>
          <button
            onClick={() => setShowAddGoal(true)}
            className="flex items-center gap-1 text-sm font-medium text-accent"
          >
            <Plus className="h-4 w-4" />
            Nueva
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {goals.map((goal) => {
            const Icon = goal.icon
            const progress = (goal.currentAmount / goal.targetAmount) * 100

            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="block rounded-2xl bg-card p-5 transition-transform active:scale-[0.98]"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                      goal.color
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {goal.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {goal.targetDate}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-foreground">
                          {formatCurrency(goal.currentAmount)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          de {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full bg-gradient-to-r transition-all",
                            goal.color
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round(progress)}% completado
                      </p>
                    </div>

                    {/* Add Money Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        setShowAddMoney(goal.id)
                      }}
                      className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-muted text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar dinero
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-card max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b bg-card p-6">
              <h2 className="text-xl font-bold text-foreground">
                Agregar a la meta
              </h2>
              <button
                onClick={() => setShowAddMoney(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-6 pb-32">
              <p className="text-center text-lg font-medium text-foreground">
                ¿Cuánto quieres ahorrar?
              </p>
              
              {/* Amount Input */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-medium text-muted-foreground">RD$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className="w-32 bg-transparent text-center text-4xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>

              {/* Quick amounts */}
              <div className="flex flex-wrap justify-center gap-2">
                {[500, 1000, 2000, 5000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAddAmount(amount.toString())}
                    className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                  >
                    +{amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Sticky Button */}
            <div className="sticky bottom-0 border-t bg-card p-6 pb-safe">
              <Button
                onClick={handleAddMoney}
                disabled={!addAmount || parseFloat(addAmount) <= 0}
                className="h-14 w-full rounded-2xl text-base font-semibold"
              >
                Agregar al ahorro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-card max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b bg-card p-6">
              <h2 className="text-xl font-bold text-foreground">
                Nueva meta
              </h2>
              <button
                onClick={() => setShowAddGoal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {/* Icon selector */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Icono
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {goalIcons.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      className="flex flex-col items-center gap-1 rounded-xl bg-muted p-3 transition-colors hover:bg-muted/80"
                    >
                      <Icon className="h-5 w-5 text-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Nombre de la meta
                </p>
                <input
                  type="text"
                  placeholder="Ej: Viaje a Europa"
                  className="h-12 w-full rounded-xl bg-muted px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Amount */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Monto objetivo
                </p>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="RD$ 0"
                  className="h-12 w-full rounded-xl bg-muted px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              <Button
                onClick={() => setShowAddGoal(false)}
                className="h-12 w-full rounded-2xl text-base font-semibold"
              >
                Crear meta
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
