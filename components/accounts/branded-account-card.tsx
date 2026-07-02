"use client"

import { Banknote, Building2, CreditCard, Landmark, PiggyBank, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, getAccountBrandingDefaults, getAvailableCreditByCurrency, getReadableTextColor } from "@/lib/data"
import type { Account } from "@/lib/types/database"

const iconMap = {
  "banknote": Banknote,
  "building-2": Building2,
  "credit-card": CreditCard,
  "landmark": Landmark,
  "piggy-bank": PiggyBank,
  "wallet": Wallet,
} as const

type BrandedAccountCardProps = {
  account: Account
  compact?: boolean
  className?: string
}

function getDisplayAccountNumber(value?: string | null, fallback?: string) {
  return value?.trim() || fallback || "Sin número"
}

export function BrandedAccountCard({ account, compact = false, className }: BrandedAccountCardProps) {
  const defaults = getAccountBrandingDefaults(account.type)
  const hasPending = Boolean((account as any).hasPendingChanges)
  const primaryColor = account.primary_color || defaults.primaryColor
  const secondaryColor = account.secondary_color || defaults.secondaryColor
  const iconType = account.icon_type || defaults.iconType
  const iconValue = account.icon_value || defaults.iconValue
  const textColor = getReadableTextColor(primaryColor)
  const isCredit = account.type === "credit"
  const debtDop = Math.abs(Number(account.current_debt_dop ?? account.current_debt ?? 0))
  const debtUsd = Math.abs(Number(account.current_debt_usd || 0))
  const hasDopLimit = Number(account.credit_limit_dop || 0) > 0
  const hasUsdLimit = Number(account.credit_limit_usd || 0) > 0
  const isMultiCurrency = isCredit && hasDopLimit && hasUsdLimit
  const balanceValue = isCredit ? debtDop || debtUsd || Math.abs(Number(account.current_debt || 0)) : Number(account.balance || 0)
  const dopAvailable = isCredit ? getAvailableCreditByCurrency(account as any, "DOP") : 0
  const usdAvailable = isCredit ? getAvailableCreditByCurrency(account as any, "USD") : 0
  const dueDate = account.statement_due_date ? new Date(`${account.statement_due_date}T12:00:00`) : null
  const today = new Date()
  const daysUntilDue = dueDate
    ? Math.ceil((new Date(dueDate.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const dueSoon = typeof daysUntilDue === "number" && daysUntilDue >= 0 && daysUntilDue <= 3 && balanceValue > 0
  const overdue = typeof daysUntilDue === "number" && daysUntilDue < 0 && balanceValue > 0
  const Icon = iconMap[(iconValue as keyof typeof iconMap) || "building-2"] || Building2
  const accountTypeLabel = account.type === "cash" ? "Efectivo" : account.type === "debit" ? "Débito" : "Crédito"
  const displayNumber = getDisplayAccountNumber((account as any).account_number as string | null | undefined, account.id)

  const styleMode = account.background_style || "gradient"
  const background =
    styleMode === "solid"
      ? primaryColor
      : styleMode === "glass"
        ? `linear-gradient(145deg, color-mix(in oklab, ${primaryColor} 72%, white), color-mix(in oklab, ${secondaryColor} 68%, white))`
        : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`

  return (
    <div
      className={cn(
        "tap-lift relative overflow-hidden rounded-[1.8rem] shadow-[0_22px_54px_-26px_rgba(0,0,0,0.62)] ring-1 ring-white/15 transition-[transform,box-shadow,filter] duration-300 ease-[var(--ease-out-ios)]",
        compact ? "p-3" : "p-4",
        className
      )}
      style={{ background, color: textColor }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_38%,rgba(0,0,0,0.16))]" />
      <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/15 blur-sm" />
      <div className="absolute -bottom-16 left-8 h-36 w-36 rounded-full border border-white/20" />
      <div className="absolute bottom-6 right-5 h-16 w-24 rounded-full bg-black/10 blur-2xl" />
      <div className="absolute left-0 right-0 top-0 h-px bg-white/30" />

      <div className="relative z-10 flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden backdrop-blur-sm",
            iconType === "image" && account.icon_url ? "rounded-full bg-transparent" : "rounded-2xl bg-white/20"
          )}
        >
          {iconType === "image" && account.icon_url ? (
            <img
              src={account.icon_url}
              alt={account.name}
              className="h-full w-full object-contain p-1.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
              onError={(event) => {
                event.currentTarget.style.display = "none"
              }}
            />
          ) : iconType === "emoji" ? (
            <span className="text-xl">{iconValue || "🏦"}</span>
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold opacity-75">{isCredit ? "Tarjeta de crédito" : accountTypeLabel}</p>
            {hasPending && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" title="Tiene movimientos pendientes sin sincronizar" />
            )}
          </div>
          <h3 className="text-reflow text-[1.04rem] font-bold leading-tight">{account.name}</h3>
          <p className="mt-1 text-[0.6875rem] opacity-80">
            Cuenta <span className="overflow-wrap-anywhere rounded-full bg-white/15 px-2 py-0.5 font-medium">{displayNumber}</span>
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-4 h-px bg-white/20" />

      <div className="relative z-10 mt-3">
        {isCredit ? (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold opacity-80">Deuda actual</p>
              {hasPending && <span className="animate-pulse text-[0.5625rem] font-medium text-amber-200">(Tiene pendientes)</span>}
            </div>
            <div className="mt-1 space-y-0.5">
              {isMultiCurrency ? (
                <div className="flex items-baseline gap-4">
                  <span className={cn("font-black tabular-nums tracking-tight", compact ? "text-xl" : "text-display-secondary")}>
                    {formatCurrency(debtDop, "DOP")}
                  </span>
                  <span className={cn("font-black tabular-nums tracking-tight text-white/70", compact ? "text-base" : "text-[1.125rem]")}>
                    {formatCurrency(debtUsd, "USD")}
                  </span>
                </div>
              ) : (
                <p className={cn("font-black tabular-nums tracking-tight", compact ? "text-xl" : "text-display-secondary")}>
                  {formatCurrency(debtDop || debtUsd || Math.abs(Number(account.current_debt || 0)), hasDopLimit ? "DOP" : "USD")}
                </p>
              )}
            </div>
            {(dueSoon || overdue) && (
              <div
                className={cn(
                  "mt-2 inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-bold backdrop-blur-sm",
                  overdue ? "bg-red-500/20 text-white" : "bg-amber-400/20 text-white"
                )}
              >
                {overdue ? "Pago vencido" : daysUntilDue === 0 ? "Pago vence hoy" : `Pago en ${daysUntilDue} días`}
              </div>
            )}
            <div className={cn("mt-3 grid grid-cols-3 gap-2 border-t border-white/20 pt-3", compact ? "text-[0.6875rem]" : "text-xs")}>
              <div>
                <p className="opacity-70">Disponible</p>
                {isMultiCurrency ? (
                  <div className="mt-0.5 space-y-0.5">
                    <p className="font-semibold text-emerald-200">{formatCurrency(dopAvailable, "DOP")}</p>
                    <p className="font-semibold text-emerald-200/70">{formatCurrency(usdAvailable, "USD")}</p>
                  </div>
                ) : (
                  <p className="mt-0.5 font-semibold text-emerald-200">{formatCurrency(dopAvailable || usdAvailable, hasDopLimit ? "DOP" : "USD")}</p>
                )}
              </div>
              <div className="border-l border-white/20 pl-2">
                <p className="opacity-70">Corte</p>
                <p className="mt-0.5 font-semibold">
                  {account.last_statement_cutoff_date ? new Date(`${account.last_statement_cutoff_date}T12:00:00`).toLocaleDateString("es-DO", { day: "2-digit", month: "short" }) : "-"}
                </p>
              </div>
              <div className="border-l border-white/20 pl-2">
                <p className="opacity-70">Pago</p>
                <p className={cn("mt-0.5 font-semibold", dueSoon && "text-amber-100", overdue && "text-red-100")}>
                  {account.statement_due_date ? new Date(`${account.statement_due_date}T12:00:00`).toLocaleDateString("es-DO", { day: "2-digit", month: "short" }) : "-"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-xs opacity-80">Balance disponible</p>
              {hasPending && <span className="animate-pulse text-[0.5625rem] font-medium text-amber-200">(Tiene pendientes)</span>}
            </div>
            <p className="mt-1 text-display-secondary font-black tabular-nums tracking-tight">{formatCurrency(Number(account.balance || 0), account.currency)}</p>
          </>
        )}
      </div>
    </div>
  )
}
