"use client"

import { TrendingUp, TrendingDown, Target, CreditCard, CalendarDays } from "lucide-react"
import {
  calculateFinScore,
  getFinScoreLabel,
  getFinScoreColor,
  getFinScoreBg,
} from "@/lib/fin-score"
import type { Account, Transaction, Goal } from "@/lib/types/database"

type Props = {
  accounts: Account[]
  transactions: Transaction[]
  goals: Goal[]
}

const breakdownConfig = [
  { key: "consistency" as const, label: "Consistencia", icon: CalendarDays },
  { key: "savings" as const, label: "Ahorro", icon: TrendingUp },
  { key: "budget" as const, label: "Presupuesto", icon: TrendingDown },
  { key: "debt" as const, label: "Deuda", icon: CreditCard },
  { key: "goals" as const, label: "Planificación", icon: Target },
]

export function FinScoreCard({ accounts, transactions, goals }: Props) {
  const score = calculateFinScore(transactions, accounts, goals)
  const label = getFinScoreLabel(score.total)
  const colorClass = getFinScoreColor(score.total)
  const bgClass = getFinScoreBg(score.total)

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${bgClass}`}>
            <span className={`text-2xl font-bold ${colorClass}`}>
              {score.total}
            </span>
          </div>
          <div>
            <p className={`text-sm font-semibold ${colorClass}`}>{label}</p>
            <p className="text-xs text-muted-foreground">FinScore</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1">
        {breakdownConfig.map(({ key, label: breakdownLabel, icon: Icon }) => {
          const value = score[key]
          const barColor =
            value >= 70
              ? "bg-emerald-400"
              : value >= 40
              ? "bg-amber-400"
              : "bg-red-400"

          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <div className="flex h-7 w-5 items-end justify-center rounded-sm bg-muted overflow-hidden">
                <div
                  className={`w-full ${barColor} transition-all duration-500`}
                  style={{ height: `${Math.max(value, 4)}%` }}
                />
              </div>
              <Icon className="h-3 w-3 text-muted-foreground" />
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between">
        {breakdownConfig.map(({ key, label: breakdownLabel }) => (
          <p key={key} className="text-[9px] text-muted-foreground">
            {breakdownLabel.substring(0, 3)}
          </p>
        ))}
      </div>
    </div>
  )
}
