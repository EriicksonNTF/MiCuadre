"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Target,
  Plus,
  X,
  Calendar,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/data"

type GoalParams = {
  id: string
  name: string
  icon: typeof Target
  color: string
  targetAmount: number
  currentAmount: number
  targetDate: string
}

const mockGoals: Record<string, GoalParams> = {
  "1": {
    id: "1",
    name: "Fondo de emergencia",
    icon: Target,
    color: "from-rose-500 to-pink-500",
    targetAmount: 100000,
    currentAmount: 45000,
    targetDate: "Diciembre 2024",
  },
  "2": {
    id: "2",
    name: "Viaje a Punta Cana",
    icon: Target,
    color: "from-blue-500 to-cyan-500",
    targetAmount: 35000,
    currentAmount: 12500,
    targetDate: "Agosto 2024",
  },
  "3": {
    id: "3",
    name: "iPhone nuevo",
    icon: Target,
    color: "from-violet-500 to-purple-500",
    targetAmount: 75000,
    currentAmount: 30000,
    targetDate: "Octubre 2024",
  },
}

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [goalId] = useState(() => {
    // In real app, use params.id after resolving
    return "1" // Fallback for demo
  })
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [addAmount, setAddAmount] = useState("")
  const [addAccount, setAddAccount] = useState("")

  // Get goal from mock data (in real app, fetch from database)
  const goal = mockGoals[goalId] || mockGoals["1"]
  const progress = (goal.currentAmount / goal.targetAmount) * 100
  const remaining = goal.targetAmount - goal.currentAmount

  const handleAddMoney = () => {
    // In real app, update the goal in database
    setShowAddMoney(false)
    setAddAmount("")
  }

  if (!goal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-muted-foreground">Meta no encontrada</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 pt-8">
        <Link
          href="/goals"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Detalles de la meta</h1>
      </header>

      {/* Goal Card */}
      <div className="px-6 pt-4">
        <div className="rounded-3xl bg-card p-6">
          {/* Icon & Name */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                goal.color
              )}
            >
              <goal.icon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{goal.name}</p>
              <p className="text-sm text-muted-foreground">{goal.targetDate}</p>
            </div>
          </div>

          {/* Progress - Large */}
          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-foreground">
                {formatCurrency(goal.currentAmount)}
              </span>
              <span className="text-lg text-muted-foreground">
                de {formatCurrency(goal.targetAmount)}
              </span>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-all",
                  goal.color
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{Math.round(progress)}% completado</span>
              <span className="text-muted-foreground">
                {formatCurrency(remaining)} restante
              </span>
            </div>
          </div>

          {/* Days until target */}
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Fecha objetivo: {goal.targetDate}</span>
          </div>
        </div>

        {/* Add Money Button - Fixed at bottom */}
        <div className="fixed bottom-24 left-0 right-0 border-t bg-background p-4 pb-safe">
          <div className="mx-auto max-w-md">
            <Button
              onClick={() => setShowAddMoney(true)}
              className="h-14 w-full rounded-2xl text-base font-semibold"
            >
              <Plus className="mr-2 h-5 w-5" />
              Agregar dinero
            </Button>
          </div>
        </div>
      </div>

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-card max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b bg-card p-6">
              <h2 className="text-xl font-bold text-foreground">
                Agregar a {goal.name}
              </h2>
              <button
                onClick={() => setShowAddMoney(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-6 px-6 pb-32">
              <p className="text-center text-lg font-medium text-foreground">
                ¿Cuánto quieres agregar?
              </p>
              
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

              {/* Account Selection */}
              <div>
                <p className="mb-3 text-sm font-medium text-foreground">
                  Desde cuenta
                </p>
                <div className="flex gap-3">
                  {[
                    { id: "cash", name: "Efectivo", icon: Wallet },
                    { id: "debit", name: "Débito", icon: TrendingUp },
                  ].map(({ id, name, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setAddAccount(id)}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border p-4 transition-all",
                        addAccount === id
                          ? "border-primary bg-primary/10"
                          : "bg-background hover:border-primary/50"
                      )}
                    >
                      <Icon className={cn("h-6 w-6", addAccount === id ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-medium", addAccount === id ? "text-primary" : "text-muted-foreground")}>
                        {name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Button */}
            <div className="sticky bottom-0 border-t bg-card p-6 pb-safe">
              <Button
                onClick={handleAddMoney}
                disabled={!addAmount || parseFloat(addAmount) <= 0 || !addAccount}
                className="h-14 w-full rounded-2xl text-base font-semibold"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}