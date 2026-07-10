"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Search, CalendarDays, X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { AccountType } from "@/lib/types/database"

export interface FilterValues {
  searchQuery: string
  datePreset: string
  startDate: string
  endDate: string
  amountMin: string
  amountMax: string
  filterType: "all" | "income" | "expense"
  accountId: string
}

interface TransactionFilterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentValues: FilterValues
  accountType?: AccountType
  showAccountFilter?: boolean
  accounts?: { id: string; name: string; type: AccountType }[]
  onApply: (values: FilterValues) => void
  onClear: () => void
}

const DATE_PRESETS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "7d" },
  { value: "month", label: "Mes" },
  { value: "3months", label: "3m" },
  { value: "all", label: "Todo" },
]

const TYPE_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
] as const

const DEFAULT_VALUES: FilterValues = {
  searchQuery: "",
  datePreset: "all",
  startDate: "",
  endDate: "",
  amountMin: "",
  amountMax: "",
  filterType: "all",
  accountId: "all",
}

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

export function TransactionFilterModal({
  open,
  onOpenChange,
  currentValues,
  accountType,
  showAccountFilter = false,
  accounts = [],
  onApply,
  onClear,
}: TransactionFilterModalProps) {
  const [local, setLocal] = useState<FilterValues>(currentValues)

  useEffect(() => {
    if (open) setLocal(currentValues)
  }, [open, currentValues])

  const update = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }

  const handleApply = () => {
    onApply(local)
    onOpenChange(false)
  }

  const handleClear = () => {
    setLocal(DEFAULT_VALUES)
    onClear()
    onOpenChange(false)
  }

  const showTypeFilter = accountType === "credit" || showAccountFilter
  const showDateInputs = local.datePreset === "custom"

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto max-w-md rounded-t-2xl border-border bg-card px-4 pb-6 shadow-2xl ring-1 ring-border">
        <DrawerHeader className="px-0">
          <DrawerTitle className="text-left">Filtrar movimientos</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-0.5">
          {/* Search */}
          <FilterSection label="Buscar">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={local.searchQuery}
                onChange={(e) => update("searchQuery", e.target.value)}
                placeholder="Nombre, categoría o monto"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {local.searchQuery && (
                <button type="button" onClick={() => update("searchQuery", "")}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </FilterSection>

          {/* Date */}
          <FilterSection label="Fecha">
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    update("datePreset", local.datePreset === preset.value ? "all" : preset.value)
                  }
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    local.datePreset === preset.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom date toggle */}
            <button
              type="button"
              onClick={() => update("datePreset", showDateInputs ? "all" : "custom")}
              className={cn(
                "mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                showDateInputs
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Personalizado</span>
            </button>

            {showDateInputs && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={local.startDate}
                    onChange={(e) => update("startDate", e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={local.endDate}
                    onChange={(e) => update("endDate", e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  />
                </div>
              </div>
            )}
          </FilterSection>

          {/* Amount */}
          <FilterSection label="Monto">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                  Mínimo
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={local.amountMin}
                  onChange={(e) => update("amountMin", e.target.value)}
                  placeholder="RD$ 0"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                  Máximo
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={local.amountMax}
                  onChange={(e) => update("amountMax", e.target.value)}
                  placeholder="RD$ 0"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </FilterSection>

          {/* Type (credit / history only) */}
          {showTypeFilter && (
            <FilterSection label="Tipo">
              <div className="flex gap-1.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("filterType", opt.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      local.filterType === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Account (history only) */}
          {showAccountFilter && (
            <FilterSection label="Cuenta">
              <select
                value={local.accountId}
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
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Buscar
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
