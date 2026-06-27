"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Plus, Pencil, Trash2, Star } from "lucide-react"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { cn } from "@/lib/utils"
import { createCategory, deleteCategory, updateCategory, useCategories } from "@/hooks/use-data"
import { MobilePageShell } from "@/components/ui/mobile-foundation"

const COLOR_PRESETS = [
  "#0f766e",
  "#0b4a8a",
  "#b45309",
  "#be123c",
  "#6d28d9",
  "#0891b2",
  "#64748b",
]

export function CategoriesScreen() {
  const { data: categories = [] } = useCategories()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("circle")
  const [color, setColor] = useState("#64748b")
  const [type, setType] = useState<"expense" | "income" | "both">("expense")
  const [isSubscription, setIsSubscription] = useState(false)

  const sorted = useMemo(() => [...categories].sort((a, b) => Number(a.is_default) - Number(b.is_default)), [categories])
  const defaultCategories = useMemo(() => sorted.filter((item) => item.is_default), [sorted])
  const customCategories = useMemo(() => sorted.filter((item) => !item.is_default), [sorted])

  const openCreate = () => {
    setEditingId(null)
    setName("")
    setIcon("circle")
    setColor("#64748b")
    setType("expense")
    setIsSubscription(false)
    setShowModal(true)
  }

  const openEdit = (id: string) => {
    const target = categories.find((item) => item.id === id)
    if (!target || target.is_default) return
    setEditingId(id)
    setName(target.name)
    setIcon(target.icon)
    setColor(target.color)
    setType(target.type)
    setIsSubscription(Boolean(target.is_subscription))
    setShowModal(true)
  }

  const save = async () => {
    if (!name.trim()) return
    const payload = { name: name.trim(), icon: icon || "circle", color: color || "#64748b", type, is_subscription: isSubscription }
    if (editingId) {
      await updateCategory(editingId, payload)
    } else {
      await createCategory({ ...payload, is_default: false })
    }
    setShowModal(false)
  }

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Categorías</h1>
          </div>
          <button type="button" onClick={openCreate} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Nueva</button>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-6 px-6 pt-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Predeterminadas</h2>
            <span className="text-xs text-muted-foreground">{defaultCategories.length}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            {defaultCategories.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">No hay categorías predeterminadas.</p>
            ) : (
              defaultCategories.map((category, index) => (
                <div key={category.id} className={cn("flex items-center gap-3 px-4 py-3", index !== defaultCategories.length - 1 && "border-b border-border/60")}>
                  <div className="h-9 w-9 rounded-full ring-2 ring-background" style={{ backgroundColor: category.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {category.type === "expense" ? "Gasto" : category.type === "income" ? "Ingreso" : "Ambos"}
                      </span>
                      {category.is_subscription && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">suscripción</span>}
                      <Star className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personalizadas</h2>
            <span className="text-xs text-muted-foreground">{customCategories.length}</span>
          </div>
          <div className="space-y-2">
            {customCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Aún no tienes categorías personalizadas.
              </div>
            ) : (
              customCategories.map((category) => (
                <div key={category.id} className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full ring-2 ring-background" style={{ backgroundColor: category.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {category.type === "expense" ? "Gasto" : category.type === "income" ? "Ingreso" : "Ambos"}
                        </span>
                        {category.is_subscription && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">suscripción</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => openEdit(category.id)} className="rounded-lg bg-muted p-2"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteCategory(category.id)} className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showModal && (
        <BaseModalForm
          title={editingId ? "Editar categoría" : "Nueva categoría"}
          onClose={() => setShowModal(false)}
          footer={<button type="button" onClick={save} className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">Guardar</button>}
        >
          <div className="space-y-4 pb-safe-areas">
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Nombre</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Supermercado"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm"
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Tipo</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["expense", "income", "both"] as const).map((item) => (
                  <button type="button"
                    key={item}
                    onClick={() => setType(item)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                      type === item ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                    )}
                  >
                    {item === "expense" ? "Gasto" : item === "income" ? "Ingreso" : "Ambos"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Color</p>
                <input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-xs"
                />
              </div>
              <div className="mt-3 flex gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background", color === preset ? "ring-primary" : "ring-transparent")}
                    style={{ backgroundColor: preset }}
                    aria-label={`Color ${preset}`}
                  />
                ))}
              </div>
            </div>

            <button type="button"
              onClick={() => setIsSubscription((prev) => !prev)}
              className={cn(
                "h-11 w-full rounded-xl text-sm font-medium",
                isSubscription ? "bg-amber-600 text-amber-50 dark:bg-amber-500 dark:text-amber-950" : "bg-muted text-foreground"
              )}
            >
              {isSubscription ? "Categoría de suscripción: activa" : "Categoría de suscripción: inactiva"}
            </button>
          </div>
        </BaseModalForm>
      )}
    </MobilePageShell>
  )
}
