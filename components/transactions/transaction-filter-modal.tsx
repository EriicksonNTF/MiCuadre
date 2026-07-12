"use client"

import { useState, useEffect, type ReactNode } from "react"
import { X, CalendarDays } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { DateWheelPicker } from "@/components/ui/date-wheel-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AccountType } from "@/lib/types/database"

export interface FilterValues {
  searchQuery: string
  startDate: Date
  endDate: Date
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

const TYPE_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
] as const

function getDefaultMonthRange(): { startDate: Date; endDate: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { startDate: from, endDate: to }
}

const DEFAULT_VALUES: FilterValues = {
  searchQuery: "",
  ...getDefaultMonthRange(),
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto max-w-md rounded-t-2xl border-border bg-card px-4 pb-6 shadow-2xl ring-1 ring-border">
        <DrawerHeader className="px-0">
          <DrawerTitle className="text-left">Filtrar movimientos</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-0.5">
          {/* Date */}
          <FilterSection label="Fecha">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                  Desde
                </label>
                <DateWheelPicker value={local.startDate} onChange={(d) => update("startDate", d)}>
                  <button type="button" className="flex h-10 w-full items-center rounded-2xl border border-border bg-background px-3 text-sm text-foreground">
                    <CalendarDays className="mr-2 inline h-4 w-4 shrink-0 text-muted-foreground" />
                    {format(local.startDate, "d MMM yyyy", { locale: es })}
                  </button>
                </DateWheelPicker>
              </div>
              <div>
                <label className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                  Hasta
                </label>
                <DateWheelPicker value={local.endDate} onChange={(d) => update("endDate", d)}>
                  <button type="button" className="flex h-10 w-full items-center rounded-2xl border border-border bg-background px-3 text-sm text-foreground">
                    <CalendarDays className="mr-2 inline h-4 w-4 shrink-0 text-muted-foreground" />
                    {format(local.endDate, "d MMM yyyy", { locale: es })}
                  </button>
                </DateWheelPicker>
              </div>
            </div>
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
                  className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
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
                  className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
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
              <Select value={local.accountId} onValueChange={(v) => update("accountId", v)}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Todas las cuentas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
