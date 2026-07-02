"use client"

import { useState } from "react"
import { ChevronDown, Plus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAccounts } from "@/hooks/use-data"
import { BrandedAccountCard } from "@/components/accounts/branded-account-card"

export function AccountsList() {
  const { data: accounts, isLoading } = useAccounts()
  const [showAllCredit, setShowAllCredit] = useState(false)
  const [showAllCashDebit, setShowAllCashDebit] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-[1.6rem] bg-card/80 shadow-sm" />
        ))}
      </div>
    )
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="mobile-card p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          <Plus className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">No tienes cuentas todavía</p>
        <p className="mt-1 text-xs text-muted-foreground">Agrega tu primera cuenta y empieza a rastrear tu dinero.</p>
        <Link
          href="/accounts"
          className="tap-lift mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)]"
        >
          <Plus className="h-4 w-4" />
          Agregar primera cuenta
        </Link>
      </div>
    )
  }

  const creditAccounts = accounts.filter((account) => account.type === "credit")
  const cashDebitAccounts = accounts.filter((account) => account.type !== "credit")

  return (
    <div className="flex flex-col gap-6">
      <AccountSectionHeader
        eyebrow="Tarjetas"
        title="Crédito y cortes"
        count={creditAccounts.length}
        expanded={showAllCredit}
        onToggle={creditAccounts.length > 1 ? () => setShowAllCredit((value) => !value) : undefined}
      />
      <div className="flex flex-col gap-3">
        {(showAllCredit ? creditAccounts : creditAccounts.slice(0, 1)).map((account) => (
          <Link key={account.id} href={`/accounts/${account.id}`} className="group block">
            <BrandedAccountCard account={account} compact />
          </Link>
        ))}
        {creditAccounts.length === 0 && (
          <div className="rounded-2xl bg-card/70 p-4 text-xs text-muted-foreground ring-1 ring-border/55">
            No hay tarjetas de crédito.
          </div>
        )}
      </div>

      <AccountSectionHeader
        eyebrow="Cuentas"
        title="Efectivo y débito"
        count={cashDebitAccounts.length}
        expanded={showAllCashDebit}
        onToggle={cashDebitAccounts.length > 1 ? () => setShowAllCashDebit((value) => !value) : undefined}
      />
      <div className="flex flex-col gap-3">
        {(showAllCashDebit ? cashDebitAccounts : cashDebitAccounts.slice(0, 1)).map((account) => (
          <Link key={account.id} href={`/accounts/${account.id}`} className="group block">
            <BrandedAccountCard account={account} compact />
          </Link>
        ))}
      </div>
    </div>
  )
}

function AccountSectionHeader({
  eyebrow,
  title,
  count,
  expanded,
  onToggle,
}: {
  eyebrow: string
  title: string
  count: number
  expanded: boolean
  onToggle?: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="section-kicker">{eyebrow}</p>
        <p className="mt-1 text-sm font-bold text-foreground">{title}</p>
      </div>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="tap-lift flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Ocultar" : `Ver ${count}`}
        </button>
      ) : null}
    </div>
  )
}
