"use client"

import { type Dispatch, type SetStateAction } from "react"
import { CalendarDays } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateWheelPicker } from "@/components/ui/date-wheel-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AccountType } from "@/lib/types/database"

export interface HistoryFilterValues {
  dateRange: { from: string; to: string }
  amountMin: string
  amountMax: string
  filterType: "all" | "income" | "expense"
  accountId: string
}

const TYPE_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
] as const

function getDefaultMonthRange(): HistoryFilterValues["dateRange"] {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

interface HistoryFilterContentProps {
  filters?: HistoryFilterValues
  setFilters?: Dispatch<SetStateAction<HistoryFilterValues>>
  accounts?: { id: string; name: string; type: AccountType }[]
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

export function HistoryFilterContent({ filters: _filters, setFilters: _setFilters, accounts = [] }: HistoryFilterContentProps) {
  const filters = _filters!
  const setFilters = _setFilters!
  const update = <K extends keyof HistoryFilterValues>(key: K, value: HistoryFilterValues[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const fromDate = new Date(filters.dateRange.from + "T12:00:00")
  const toDate = new Date(filters.dateRange.to + "T12:00:00")

  return (
    <div className="space-y-5">
      <FilterSection label="Fecha">
        <div className="grid grid-cols-2 gap-2">
          <DateWheelPicker value={fromDate} onChange={(d) => update("dateRange", { from: d.toISOString().slice(0, 10), to: filters.dateRange.to })}>
            <button type="button" className={cn(
              "flex h-11 items-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/50"
            )}>
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">{format(fromDate, "d MMM yyyy", { locale: es })}</span>
            </button>
          </DateWheelPicker>

          <DateWheelPicker value={toDate} onChange={(d) => update("dateRange", { from: filters.dateRange.from, to: d.toISOString().slice(0, 10) })}>
            <button type="button" className={cn(
              "flex h-11 items-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/50"
            )}>
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">{format(toDate, "d MMM yyyy", { locale: es })}</span>
            </button>
          </DateWheelPicker>
        </div>
      </FilterSection>

      <FilterSection label="Monto">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">Mínimo</label>
            <input
              type="number"
              inputMode="decimal"
              value={filters.amountMin}
              onChange={(e) => update("amountMin", e.target.value)}
              placeholder="RD$ 0"
              className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">Máximo</label>
            <input
              type="number"
              inputMode="decimal"
              value={filters.amountMax}
              onChange={(e) => update("amountMax", e.target.value)}
              placeholder="RD$ 0"
              className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection label="Tipo">
        <div className="flex gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update("filterType", opt.value)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filters.filterType === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Cuenta">
        <Select value={filters.accountId} onValueChange={(v) => update("accountId", v)}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Todas las cuentas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>
    </div>
  )
}
