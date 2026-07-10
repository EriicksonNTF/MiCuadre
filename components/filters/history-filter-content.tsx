"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { CalendarDays, ChevronDown } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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

function getDefaultMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

export const HISTORY_FILTER_DEFAULTS: HistoryFilterValues = {
  dateRange: getDefaultMonthRange(),
  amountMin: "",
  amountMax: "",
  filterType: "all",
  accountId: "all",
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

  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)

  const fromDate = filters.dateRange.from ? new Date(filters.dateRange.from + "T12:00:00") : undefined
  const toDate = filters.dateRange.to ? new Date(filters.dateRange.to + "T12:00:00") : undefined

  return (
    <div className="space-y-5">
      <FilterSection label="Fecha">
        <div className="grid grid-cols-2 gap-2">
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={cn(
                "flex h-11 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/50",
                !fromDate && "text-muted-foreground"
              )}>
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{fromDate ? format(fromDate, "d MMM yyyy", { locale: es }) : "Desde"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(d) => {
                  if (d) {
                    update("dateRange", { from: d.toISOString().slice(0, 10), to: filters.dateRange.to })
                    setFromOpen(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={cn(
                "flex h-11 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/50",
                !toDate && "text-muted-foreground"
              )}>
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{toDate ? format(toDate, "d MMM yyyy", { locale: es }) : "Hasta"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(d) => {
                  if (d) {
                    update("dateRange", { from: filters.dateRange.from, to: d.toISOString().slice(0, 10) })
                    setToOpen(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
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
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
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
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
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
        <select
          value={filters.accountId}
          onChange={(e) => update("accountId", e.target.value)}
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="all">Todas las cuentas</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </FilterSection>
    </div>
  )
}
