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

function maskAccountNumber(value?: string | null, fallback?: string) {
  const source = (value || fallback || "").replace(/\s+/g, "")
  if (!source) return "••••"
  return `•••• ${source.slice(-4)}`
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
  const maskedNumber = maskAccountNumber((account as any).account_number as string | null | undefined, account.id)

  const styleMode = account.background_style || "gradient"
  const background =
    styleMode === "solid"
      ? primaryColor
      : styleMode === "glass"
      ? `linear-gradient(145deg, color-mix(in oklab, ${primaryColor} 72%, white), color-mix(in oklab, ${secondaryColor} 68%, white))`
      : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`

  return (
    <div
      className={cn("relative overflow-hidden rounded-[1.6rem] p-4 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.55)] transition-all duration-300", className)}
      style={{ background, color: textColor }}
    >
      <div className="absolute right-[-24px] top-[-28px] h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute bottom-[-40px] right-8 h-32 w-32 rounded-full bg-black/10" />

      <div className="relative z-10 flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden backdrop-blur-sm",
            iconType === "image" && account.icon_url
              ? "rounded-full bg-transparent"
              : "rounded-2xl bg-white/20"
          )}
        >
          {iconType === "image" && account.icon_url ? (
            <img
              src={account.icon_url}
              alt={account.name}
              className="h-full w-full object-contain p-1.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : iconType === "emoji" ? (
            <span className="text-xl">{iconValue || "🏦"}</span>
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold opacity-75">{isCredit ? "Tarjeta de crédito" : accountTypeLabel}</p>
          <h3 className="truncate text-[1.04rem] font-bold leading-tight">{account.name}</h3>
          <p className="mt-1 text-[11px] opacity-80">
            Cuenta <span className="rounded-full bg-white/15 px-2 py-0.5 font-medium">{maskedNumber}</span>
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-4 h-px bg-white/20" />

      <div className="relative z-10 mt-3">
        {isCredit ? (
          <>
            <div className={cn("grid grid-cols-3 gap-2", compact ? "text-[11px]" : "text-xs")}>
              <div>
                <p className="opacity-75">Deuda</p>
                <p className="mt-1 font-bold">{formatCurrency(balanceValue, account.currency)}</p>
              </div>
              <div className="border-l border-white/20 pl-2">
                <p className="opacity-75">Disponible</p>
                <p className="font-semibold">{formatCurrency(getAvailableCredit({
                  type: account.type,
                  creditLimit: account.credit_limit,
                  currentDebt: account.current_debt,
                }), account.currency)}</p>
              </div>
              <div className="border-l border-white/20 pl-2">
                <p className="opacity-75">Límite</p>
                <p className="font-semibold">{formatCurrency(account.credit_limit || 0, account.currency)}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs opacity-80">Balance disponible</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{formatCurrency(Number(account.balance || 0), account.currency)}</p>
          </>
        )}
      </div>
    </div>
  )
}
