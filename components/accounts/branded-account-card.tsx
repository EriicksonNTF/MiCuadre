"use client"

import { Banknote, Building2, CreditCard, Landmark, PiggyBank, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, getAccountBrandingDefaults, getAvailableCredit, getReadableTextColor } from "@/lib/data"
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

export function BrandedAccountCard({ account, compact = false, className }: BrandedAccountCardProps) {
  const defaults = getAccountBrandingDefaults(account.type)
  const primaryColor = account.primary_color || defaults.primaryColor
  const secondaryColor = account.secondary_color || defaults.secondaryColor
  const iconType = account.icon_type || defaults.iconType
  const iconValue = account.icon_value || defaults.iconValue
  const textColor = getReadableTextColor(primaryColor)
  const isCredit = account.type === "credit"
  const balanceValue = isCredit ? Math.abs(account.current_debt || 0) : Number(account.balance || 0)
  const Icon = iconMap[(iconValue as keyof typeof iconMap) || "building-2"] || Building2
  const accountTypeLabel = account.type === "cash" ? "Efectivo" : account.type === "debit" ? "Débito" : "Crédito"

  const styleMode = account.background_style || "gradient"
  const background =
    styleMode === "solid"
      ? primaryColor
      : styleMode === "glass"
      ? `linear-gradient(145deg, color-mix(in oklab, ${primaryColor} 72%, white), color-mix(in oklab, ${secondaryColor} 68%, white))`
      : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`

  return (
    <div
      className={cn("relative overflow-hidden rounded-[1.7rem] p-5 shadow-lg", className)}
      style={{ background, color: textColor }}
    >
      <div className="absolute right-[-20px] top-[-24px] h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute bottom-[-26px] right-10 h-28 w-28 rounded-full bg-black/10" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs opacity-80">{isCredit ? "Tarjeta de crédito" : "Cuenta"}</p>
          <h3 className="truncate text-lg font-semibold">{account.name}</h3>
          <p className="text-xs opacity-80">{accountTypeLabel}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/20">
          {iconType === "image" && account.icon_url ? (
            <img
              src={account.icon_url}
              alt={account.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : iconType === "emoji" ? (
            <span className="text-2xl">{iconValue || "🏦"}</span>
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </div>
      </div>

      <div className="relative z-10 mt-6">
        {isCredit ? (
          <>
            <p className="text-xs opacity-80">Deuda</p>
            <p className="text-3xl font-bold">{formatCurrency(balanceValue, account.currency)}</p>
            <div className={cn("mt-4 grid grid-cols-2 gap-3", compact ? "text-xs" : "text-sm")}>
              <div>
                <p className="text-[11px] opacity-75">Disponible</p>
                <p className="font-semibold">{formatCurrency(getAvailableCredit({
                  type: account.type,
                  creditLimit: account.credit_limit,
                  currentDebt: account.current_debt,
                }), account.currency)}</p>
              </div>
              <div>
                <p className="text-[11px] opacity-75">Límite</p>
                <p className="font-semibold">{formatCurrency(account.credit_limit || 0, account.currency)}</p>
              </div>
            </div>
            {account.due_date && (
              <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs">
                Pagar antes del día {account.due_date}
              </span>
            )}
          </>
        ) : (
          <>
            <p className="text-xs opacity-80">Balance disponible</p>
            <p className="text-3xl font-bold">{formatCurrency(Number(account.balance || 0), account.currency)}</p>
          </>
        )}
      </div>
    </div>
  )
}
