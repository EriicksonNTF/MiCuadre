"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCategories } from "@/hooks/use-data"
import { createBudget, deactivateBudget, updateBudget } from "@/hooks/use-planning"
import { notify } from "@/lib/notifications"
import type { BudgetWithUsage } from "@/types/planning"

export function BudgetFormSheet({
  open,
  onOpenChange,
  budget,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget: BudgetWithUsage | null
}) {
  const { data: categories = [] } = useCategories()
  const expenseCategories = useMemo(() => categories.filter((c) => c.type === "expense" || c.type === "both"), [categories])
  const [categoryId, setCategoryId] = useState("")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<"DOP" | "USD">("DOP")
  const [threshold, setThreshold] = useState("80")
  const [saving, setSaving] = useState(false)

  const prevBudgetKey = useRef("")
  const currentBudgetKey = open ? `open-${budget?.id ?? "new"}` : "closed"
  if (currentBudgetKey !== prevBudgetKey.current) {
    prevBudgetKey.current = currentBudgetKey
    if (!open) {
      setCategoryId("")
      setName("")
      setAmount("")
      setCurrency("DOP")
      setThreshold("80")
    } else if (budget) {
      setCategoryId(budget.category_id || "")
      setName(budget.name)
      setAmount(String(budget.amount || ""))
      setCurrency((budget.currency as "DOP" | "USD") || "DOP")
      setThreshold(String(budget.alert_threshold || 80))
    } else {
      setCategoryId("")
      setName("")
      setAmount("")
      setCurrency("DOP")
      setThreshold("80")
    }
  }

  const onSave = async () => {
    const selected = expenseCategories.find((c) => c.id === categoryId) || null
    if ((!selected && !budget) || !name.trim() || !amount.trim()) {
      notify({ title: "Completa los campos", message: "Selecciona categoria y monto mensual." })
      return
    }
    setSaving(true)
    try {
      if (budget) {
        await updateBudget({
          id: budget.id,
          category_id: selected?.id || budget.category_id,
          category_name: selected?.name || budget.category_name,
          name: name.trim(),
          amount: Number(amount),
          currency,
          alert_threshold: Number(threshold || 80),
        })
        notify({ title: "Presupuesto actualizado", message: "Los cambios fueron guardados." })
      } else {
        await createBudget({
          category_id: selected?.id || null,
          category_name: selected?.name || "Sin categoria",
          name: name.trim(),
          amount: Number(amount),
          currency,
          alert_threshold: Number(threshold || 80),
        })
        notify({ title: "Presupuesto creado", message: "Tu presupuesto ya esta activo para este mes." })
      }
      onOpenChange(false)
    } catch {
      notify({ title: "Error", message: "No se pudo guardar el presupuesto." })
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!budget) return
    setSaving(true)
    try {
      await deactivateBudget(budget.id)
      notify({ title: "Presupuesto eliminado", message: "Se desactivo correctamente." })
      onOpenChange(false)
    } catch {
      notify({ title: "Error", message: "No se pudo eliminar el presupuesto." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto max-w-md rounded-t-2xl border-border bg-card px-4 pb-6 shadow-2xl ring-1 ring-border">
        <DrawerHeader className="px-0">
          <DrawerTitle>{budget ? "Editar presupuesto" : "Nuevo presupuesto"}</DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-0.5">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Categoría</span>
            <Select value={categoryId} onValueChange={(next) => {
              setCategoryId(next)
              const picked = expenseCategories.find((c) => c.id === next)
              if (picked && !name) setName(`Presupuesto ${picked.name}`)
            }}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Selecciona categoria" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input className="h-11 w-full rounded-xl border border-border bg-background px-3" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Monto mensual</span>
            <MoneyInput value={amount} onValueChange={setAmount} className="h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Moneda</span>
            <Select value={currency} onValueChange={(v) => setCurrency(v as "DOP" | "USD")}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOP">DOP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Alertarme cuando llegue a</span>
            <input type="number" inputMode="numeric" min={1} max={100} className="h-11 w-full rounded-xl border border-border bg-background px-3" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </label>
          <button type="button" disabled={saving} onClick={onSave} className="mt-2 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar presupuesto"}
          </button>
          {budget && (
            <button type="button" disabled={saving} onClick={onDelete} className="h-11 w-full rounded-xl bg-destructive text-sm font-bold text-primary-foreground disabled:opacity-60">
              Eliminar presupuesto
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
