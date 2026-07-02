"use client"

import { ArrowDownLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useTransactions } from "@/hooks/use-data"
import { getLocalDateString } from "@/lib/data"
import { TransactionRow, TransactionGroup } from "@/components/transactions"
import type { TransactionRowData } from "@/components/transactions"
import type { Transaction } from "@/lib/types/database"

export function TransactionsList() {
  const { data: transactions, isLoading } = useTransactions(10)

  const parseTxDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  const formatGroupLabel = (date: Date) => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const key = getLocalDateString(date)
    if (key === getLocalDateString(today)) return "Hoy"
    if (key === getLocalDateString(yesterday)) return "Ayer"
    return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
  }

  const grouped = (transactions || []).reduce((acc, tx) => {
    const date = parseTxDate(tx.date)
    const key = getLocalDateString(date)
    if (!acc[key]) {
      acc[key] = { label: formatGroupLabel(date), date, items: [] as Transaction[] }
    }
    acc[key].items.push(tx)
    return acc
  }, {} as Record<string, { label: string; date: Date; items: Transaction[] }>)

  const groups = Object.entries(grouped)
    .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
    .map(([key, value]) => ({ key, ...value }))

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader />
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-2xl bg-card/80 shadow-sm" />
          ))}
        </div>
      </section>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader hideAction />
        <div className="mobile-card p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">Sin movimientos aún</p>
          <p className="mt-1 text-xs text-muted-foreground">Registra tu primer gasto o ingreso para ver tu actividad.</p>
          <Link
            href="/expense"
            className="tap-lift mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)]"
          >
            <Plus className="h-4 w-4" />
            Agregar movimiento
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader />

      <div className="overflow-hidden rounded-[1.65rem] border border-border/65 bg-card shadow-sm">
        {groups.map((group, groupIndex) => (
          <div key={group.key} className={groupIndex > 0 ? "border-t border-border/60" : undefined}>
            <div className="flex items-center justify-between bg-muted/45 px-4 py-2.5">
              <p className="text-[0.6875rem] font-black uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
              <p className="text-[0.6875rem] font-semibold text-muted-foreground">{group.items.length} mov.</p>
            </div>
            <div>
              {group.items.map((transaction) => {
                const txDate = transaction.created_at ? new Date(transaction.created_at) : parseTxDate(transaction.date)
                const txTime = txDate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })

                const row: TransactionRowData = {
                  id: transaction.id,
                  title: transaction.description || transaction.category?.name || "Transacción",
                  category: transaction.category?.icon || "circle",
                  amount: transaction.amount,
                  type: transaction.type,
                  currency: transaction.currency,
                  accountName: transaction.account?.name || "Cuenta",
                  accountType: transaction.account?.type || "cash",
                  time: txTime,
                }

                return <TransactionRow key={transaction.id} tx={row} />
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHeader({ hideAction = false }: { hideAction?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="section-kicker">Movimientos</p>
        <p className="mt-1 text-sm font-bold text-foreground">Actividad reciente</p>
      </div>
      {!hideAction && (
        <Link href="/history" className="tap-lift rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
          Ver todos
        </Link>
      )}
    </div>
  )
}
