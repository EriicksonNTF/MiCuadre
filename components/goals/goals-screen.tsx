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
import { useGoals, useAccounts, createGoal, addGoalContribution } from "@/hooks/use-data"
import { createGoalSchema, addGoalContributionSchema, parseAmount, getFieldError } from "@/lib/validation"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { notify } from "@/lib/notifications"
import { EventBus } from "@/lib/event-bus"

const goalIcons = [
  { icon: Target, label: "General", value: "Target" },
  { icon: Plane, label: "Viaje", value: "Plane" },
  { icon: Home, label: "Casa", value: "Home" },
  { icon: Car, label: "Vehículo", value: "Car" },
  { icon: Smartphone, label: "Tecnología", value: "Smartphone" },
  { icon: GraduationCap, label: "Educación", value: "GraduationCap" },
  { icon: Heart, label: "Emergencia", value: "Heart" },
  { icon: Sparkles, label: "Lujo", value: "Sparkles" },
]

const goalColors = [
  "from-rose-500 to-pink-500",
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-green-500",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-blue-500",
  "from-cyan-500 to-teal-500",
  "from-fuchsia-500 to-pink-500",
]

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

function getIconComponent(iconName: string) {
  return iconMap[iconName] || Target
}

export function GoalsScreen() {
  const { data: dbGoals, isLoading } = useGoals()
  const { data: accounts = [] } = useAccounts()

  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showAddMoney, setShowAddMoney] = useState<string | null>(null)
  const [addAmount, setAddAmount] = useState("")

  const [goalName, setGoalName] = useState("")
  const [goalNameError, setGoalNameError] = useState<string | undefined>()
  const [goalAmount, setGoalAmount] = useState("")
  const [goalAmountError, setGoalAmountError] = useState<string | undefined>()
  const [selectedIcon, setSelectedIcon] = useState("Target")
  const [selectedColor, setSelectedColor] = useState("from-rose-500 to-pink-500")
  const [isCreating, setIsCreating] = useState(false)

  const [addMoneyAmount, setAddMoneyAmount] = useState("")
  const [addMoneyAmountError, setAddMoneyAmountError] = useState<string | undefined>()
  const [contributionAccountId, setContributionAccountId] = useState("")

  const goals = dbGoals || []
  const contributionAccount = accounts.find((account) => account.id === contributionAccountId)
  const parsedContributionAmount = parseAmount(addMoneyAmount)
  const exceedsContributionBalance = Boolean(
    contributionAccount && parsedContributionAmount > Number(contributionAccount.balance || 0)
  )

  const totalSaved = goals.reduce((sum, goal) => sum + (goal.current_amount || 0), 0)
  const totalTarget = goals.reduce((sum, goal) => sum + (goal.target_amount || 0), 0)

  const handleCreateGoal = async () => {
    const nameResult = createGoalSchema.shape.name.safeParse(goalName)
    if (!nameResult.success) {
      const error = nameResult.error.errors.find((e) => e.path[0] === "name")
      setGoalNameError(error?.message)
      return
    }
    setGoalNameError(undefined)

    const amountResult = createGoalSchema.shape.targetAmount.safeParse(goalAmount)
    if (!amountResult.success) {
      const error = amountResult.error.errors.find((e) => e.path[0] === "targetAmount")
      setGoalAmountError(error?.message)
      return
    }
    setGoalAmountError(undefined)

    if (!selectedIcon || !selectedColor) return

    setIsCreating(true)
    try {
      await createGoal({
        name: goalName,
        target_amount: parseAmount(goalAmount),
        currency: "DOP",
        target_date: null,
        color: selectedColor,
        icon: selectedIcon,
      })
      notify({ title: "Meta creada", message: "Tu meta de ahorro fue creada exitosamente." })
      EventBus.emit({ type: "goal_created", payload: { name: goalName } })
      setShowAddGoal(false)
      setGoalName("")
      setGoalAmount("")
      setSelectedIcon("Target")
      setSelectedColor("from-rose-500 to-pink-500")
    } catch (error) {
      console.error("Error creating goal:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddMoney = async () => {
    const amountResult = addGoalContributionSchema.shape.amount.safeParse(addMoneyAmount)
    if (!amountResult.success) {
      const error = amountResult.error.errors.find((e) => e.path[0] === "amount")
      setAddMoneyAmountError(error?.message)
      return
    }
    setAddMoneyAmountError(undefined)

    if (!showAddMoney || !contributionAccountId) return
    if (exceedsContributionBalance) {
      const available = Number(contributionAccount?.balance || 0)
      setAddMoneyAmountError(`Disponible: ${formatCurrency(available)}. Intenta con un monto menor.`)
      notify({ title: "Saldo insuficiente", message: "Ese monto supera tu balance disponible." })
      return
    }

    try {
      await addGoalContribution({
        goal_id: showAddMoney,
        account_id: contributionAccountId,
        amount: parseAmount(addMoneyAmount),
        date: new Date().toISOString(),
        notes: null,
      })
      notify({ title: "Aporte registrado", message: "Movimiento creado con éxito y meta actualizada." })
      EventBus.emit({ type: "money_added", payload: { amount: addMoneyAmount } })
      setShowAddMoney(null)
      setAddMoneyAmount("")
      setContributionAccountId("")
    } catch (error) {
      console.error("Error adding money:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <header className="px-6 pb-4 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Metas de ahorro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu progreso hacia tus sueños
        </p>
      </header>

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
              <span>{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
              <p className="mt-4 text-sm text-muted-foreground">Cargando metas...</p>
            </div>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                No tienes metas de ahorro aún.
                <br />
                Crea tu primera meta para comenzar.
              </p>
              <Button
                onClick={() => setShowAddGoal(true)}
                className="mt-6 h-12 rounded-2xl text-base font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear meta
              </Button>
            </div>
          ) : (
            goals.map((goal) => {
              const Icon = getIconComponent(goal.icon || "Target")
              const progress = goal.target_amount > 0 
                ? (goal.current_amount / goal.target_amount) * 100 
                : 0

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
                        goal.color || "from-rose-500 to-pink-500"
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
                            {goal.target_date || "Sin fecha límite"}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="mt-4">
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg font-bold text-foreground">
                            {formatCurrency(goal.current_amount || 0)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            de {formatCurrency(goal.target_amount || 0)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full bg-gradient-to-r transition-all",
                              goal.color || "from-rose-500 to-pink-500"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Math.round(progress)}% completado
                        </p>
                      </div>

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
            })
          )}
        </div>
      </div>

      {showAddMoney && (
        <BaseModalForm
          title="Agregar a la meta"
          onClose={() => {
            setShowAddMoney(null)
            setAddMoneyAmount("")
            setAddMoneyAmountError(undefined)
            setContributionAccountId("")
          }}
          footer={
              <Button
                onClick={handleAddMoney}
                disabled={!addMoneyAmount || parseFloat(addMoneyAmount) <= 0 || !contributionAccountId || exceedsContributionBalance}
                className="h-14 w-full rounded-2xl text-base font-semibold"
              >
              Agregar al ahorro
            </Button>
          }
        >
          <div className="space-y-6">
            <p className="text-center text-lg font-medium text-foreground">
              ¿Cuánto quieres ahorrar?
            </p>

            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-medium text-muted-foreground">RD$</span>
              <input
                type="text"
                inputMode="decimal"
                value={addMoneyAmount}
                onChange={(e) => {
                  setAddMoneyAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  setAddMoneyAmountError(undefined)
                }}
                placeholder="0"
                className={cn(
                  "w-32 bg-transparent text-center text-4xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30",
                  addMoneyAmountError && "text-destructive"
                )}
                autoFocus
              />
            </div>

            {addMoneyAmountError && (
              <p className="text-center text-sm text-destructive">{addMoneyAmountError}</p>
            )}

            <div>
              <p className="mb-2 text-center text-sm font-medium text-muted-foreground">Cuenta origen</p>
              <div className="grid grid-cols-2 gap-2">
                {accounts.filter((account) => account.type !== "credit").map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setContributionAccountId(account.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition-colors",
                      contributionAccountId === account.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">{account.name}</p>
                    <p className="text-xs text-muted-foreground">Disponible: {formatCurrency(account.balance)}</p>
                  </button>
                ))}
              </div>
              {contributionAccount && (
                <p className={cn(
                  "mt-2 text-xs",
                  exceedsContributionBalance
                    ? "text-red-500"
                    : Number(contributionAccount.balance || 0) <= 1000
                      ? "text-amber-600"
                      : "text-muted-foreground"
                )}>
                  Disponible en cuenta origen: {formatCurrency(Number(contributionAccount.balance || 0))}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {[500, 1000, 2000, 5000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setAddMoneyAmount(amount.toString())
                    setAddMoneyAmountError(undefined)
                  }}
                  className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                >
                  +{amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </BaseModalForm>
      )}

      {showAddGoal && (
        <BaseModalForm
          title="Nueva meta"
          onClose={() => {
            setShowAddGoal(false)
            setGoalName("")
            setGoalAmount("")
            setGoalNameError(undefined)
            setGoalAmountError(undefined)
          }}
          footer={
            <Button
              onClick={handleCreateGoal}
              disabled={isCreating || !goalName || !goalAmount}
              className="h-12 w-full rounded-2xl text-base font-semibold"
            >
              {isCreating ? "Creando..." : "Crear meta"}
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Icono
              </p>
              <div className="grid grid-cols-4 gap-2">
                {goalIcons.map(({ icon: Icon, label, value }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedIcon(value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl p-3 transition-colors",
                      selectedIcon === value
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                {goalColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full bg-gradient-to-br transition-transform",
                      color,
                      selectedColor === color && "ring-2 ring-offset-2 ring-foreground"
                    )}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Nombre de la meta
              </p>
              <input
                type="text"
                placeholder="Ej: Viaje a Europa"
                value={goalName}
                onChange={(e) => {
                  setGoalName(e.target.value)
                  setGoalNameError(undefined)
                }}
                className={cn(
                  "h-12 w-full rounded-xl bg-muted px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/50",
                  goalNameError && "border border-destructive"
                )}
              />
              {goalNameError && (
                <p className="mt-1 text-xs text-destructive">{goalNameError}</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Monto objetivo
              </p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="RD$ 0"
                value={goalAmount}
                onChange={(e) => {
                  setGoalAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  setGoalAmountError(undefined)
                }}
                className={cn(
                  "h-12 w-full rounded-xl bg-muted px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/50",
                  goalAmountError && "border border-destructive"
                )}
              />
              {goalAmountError && (
                <p className="mt-1 text-xs text-destructive">{goalAmountError}</p>
              )}
            </div>
          </div>
        </BaseModalForm>
      )}
    </div>
  )
}
