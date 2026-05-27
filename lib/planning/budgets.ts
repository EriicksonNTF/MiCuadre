import type { BudgetStatus, BudgetWithUsage } from "@/types/planning"

export function resolveBudgetStatus(percentage: number): BudgetStatus {
  if (percentage >= 100) return "exceeded"
  if (percentage >= 90) return "warning"
  if (percentage >= 70) return "near_limit"
  return "healthy"
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(999, value))
}

export function withBudgetUsage(input: {
  budget: BudgetWithUsage | Omit<BudgetWithUsage, "spent" | "remaining" | "percentage" | "status" | "includesPending">
  spent: number
  includesPending?: boolean
}): BudgetWithUsage {
  const amount = Number(input.budget.amount || 0)
  const spent = Number(input.spent || 0)
  const percentage = amount > 0 ? clampPercentage((spent / amount) * 100) : 0
  const remaining = Number((amount - spent).toFixed(2))
  return {
    ...input.budget,
    spent: Number(spent.toFixed(2)),
    remaining,
    percentage: Number(percentage.toFixed(2)),
    status: resolveBudgetStatus(percentage),
    includesPending: Boolean(input.includesPending),
  }
}

