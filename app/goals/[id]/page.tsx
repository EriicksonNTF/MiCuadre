"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Target,
  Plus,
  X,
  Calendar,
  Plane,
  Home,
  Car,
  Smartphone,
  GraduationCap,
  Heart,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { AccountCarouselSelector } from "@/components/ui/account-carousel-selector"
import { formatCurrency, getLocalDateString } from "@/lib/data"
import { useGoals, useAccounts, addGoalContribution } from "@/hooks/use-data"
import { addGoalContributionSchema, parseAmount } from "@/lib/validation"
import { notify } from "@/lib/notifications"

const iconMap: Record<string, typeof Target> = {
  Target,
  Plane,
  Home,
  Car,
  Smartphone,
  GraduationCap,
  Heart,
  Sparkles,
}

export default function GoalDetailPage() {
  const params = useParams()
  const goalId = params.id as string

  const { data: dbGoals, isLoading: goalsLoading } = useGoals()
  const { data: dbAccounts, isLoading: accountsLoading } = useAccounts()
  const goals = dbGoals ?? []
  const accounts = dbAccounts ?? []

  const [showAddMoney, setShowAddMoney] = useState(false)
  const [addAmount, setAddAmount] = useState("")
  const [addAccountId, setAddAccountId] = useState("")
  const [addAmountError, setAddAmountError] = useState<string>()

  const goal = useMemo(() => (goals ?? []).find((g) => g.id === goalId), [goals, goalId])

  const availableAccounts = useMemo(
    () =>
      (accounts ?? [])
        .filter((a) => a.type !== "credit")
        .map((a) => ({
          id: a.id,
          title: a.name,
          subtitle: a.type === "credit"
            ? `Disponible: ${formatCurrency(Number(a.balance || 0) + Number(a.credit_limit || 0) - Number(a.pending_amount || 0), a.currency)}`
            : `Balance: ${formatCurrency(Number(a.balance || 0), a.currency)}`,
          detail: a.currency,
        })),
    [accounts]
  )

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === addAccountId),
    [accounts, addAccountId]
  )

  const exceedsBalance =
    selectedAccount &&
    addAmount &&
    parseAmount(addAmount) > Number(selectedAccount.balance || 0)

  const progress = goal && Number(goal.target_amount) > 0
    ? (Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100
    : 0

  const remaining =
    goal ? Number(goal.target_amount) - Number(goal.current_amount || 0) : 0

  const IconComponent = goal?.icon ? iconMap[goal.icon] || Target : Target

  const handleAddMoney = async () => {
    const amountResult = addGoalContributionSchema.shape.amount.safeParse(addAmount)
    if (!amountResult.success) {
      const error = amountResult.error.errors.find((e) => e.path[0] === "amount")
      setAddAmountError(error?.message)
      return
    }
    setAddAmountError(undefined)

    if (!addAccountId) return

    if (exceedsBalance) {
      const available = Number(selectedAccount?.balance || 0)
      setAddAmountError(`Disponible: ${formatCurrency(available)}. Intenta con un monto menor.`)
      notify({ title: "Saldo insuficiente", message: "Ese monto supera tu balance disponible." })
      return
    }

    try {
      const contributionAmount = parseAmount(addAmount)
      await addGoalContribution({
        goal_id: goalId,
        account_id: addAccountId,
        amount: contributionAmount,
        date: getLocalDateString(),
        notes: null,
      })

      const wasCompleted = goal?.is_completed
      const willBeCompleted =
        Number(goal?.current_amount || 0) + contributionAmount >= Number(goal?.target_amount || 0)
      if (!wasCompleted && willBeCompleted) {
        notify({ title: "Meta alcanzada!", message: `Felicidades, completaste "${goal?.name}".` })
      } else {
        notify({ title: "Aporte registrado", message: "Movimiento creado con éxito y meta actualizada." })
      }

      setShowAddMoney(false)
      setAddAmount("")
      setAddAccountId("")
      setAddAmountError(undefined)
    } catch (error) {
      console.error("Error adding money:", error)
    }
  }

  if (goalsLoading || accountsLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-muted-foreground">Meta no encontrada</p>
        <Link href="/goals">
          <Button variant="outline">Volver a metas</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <header className="flex items-center gap-4 p-4 pt-8">
        <Link
          href="/goals"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Detalles de la meta</h1>
      </header>

      <div className="px-6 pt-4">
        <div className="rounded-3xl bg-card p-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                goal.color || "from-rose-500 to-pink-500"
              )}
            >
              <IconComponent className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{goal.name}</p>
              <p className="text-sm text-muted-foreground">
                {goal.target_date || "Sin fecha límite"}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-foreground">
                {formatCurrency(Number(goal.current_amount || 0))}
              </span>
              <span className="text-lg text-muted-foreground">
                de {formatCurrency(Number(goal.target_amount))}
              </span>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-all",
                  goal.color || "from-rose-500 to-pink-500"
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

          {goal.target_date && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Fecha objetivo: {goal.target_date}</span>
            </div>
          )}
        </div>

        {goal.is_completed && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Meta completada!</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                Felicidades, alcanzaste tu meta de {formatCurrency(Number(goal.target_amount))}.
              </p>
            </div>
          </div>
        )}

        <div className="fixed bottom-24 left-0 right-0 border-t bg-background/80 backdrop-blur-sm p-4 pb-safe">
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

      {showAddMoney && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-y-auto rounded-t-3xl bg-card max-h-[90vh]">
            <div className="sticky top-0 flex items-center justify-between border-b bg-card p-6 z-10">
              <h2 className="text-xl font-bold text-foreground">
                Agregar a {goal.name}
              </h2>
              <button
                onClick={() => {
                  setShowAddMoney(false)
                  setAddAmount("")
                  setAddAccountId("")
                  setAddAmountError(undefined)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-6 pb-32">
              <p className="pt-4 text-center text-lg font-medium text-foreground">
                ¿Cuánto quieres agregar?
              </p>

              {addAmountError && (
                <p className="text-center text-sm text-red-500">{addAmountError}</p>
              )}

              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-medium text-muted-foreground">RD$</span>
                <MoneyInput
                  value={addAmount}
                  onValueChange={(v) => {
                    setAddAmount(v)
                    setAddAmountError(undefined)
                  }}
                  placeholder="0"
                  className="w-32 bg-transparent text-center text-4xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {[500, 1000, 2000, 5000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAddAmount(amount.toString())}
                    className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 active:scale-95"
                  >
                    +{amount.toLocaleString()}
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-foreground">Desde cuenta</p>
                <AccountCarouselSelector
                  compact
                  items={availableAccounts}
                  selectedId={addAccountId}
                  onSelect={(id) => {
                    setAddAccountId(id)
                    setAddAmountError(undefined)
                  }}
                />
              </div>
            </div>

            <div className="sticky bottom-0 border-t bg-card p-6 pb-safe">
              <Button
                onClick={handleAddMoney}
                disabled={
                  !addAmount ||
                  parseAmount(addAmount) <= 0 ||
                  !addAccountId ||
                  !!exceedsBalance
                }
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
