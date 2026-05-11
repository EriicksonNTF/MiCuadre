"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Plus, Pencil, Trash2, Star } from "lucide-react"
import { BaseModalForm } from "@/components/ui/base-modal-form"
import { cn } from "@/lib/utils"
import { createCategory, deleteCategory, updateCategory, useCategories } from "@/hooks/use-data"

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
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Categorias</h1>
          </div>
          <button onClick={openCreate} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Nueva</button>
        </div>
      </div>

      <div className="mx-auto grid max-w-md grid-cols-1 gap-3 px-6 pt-6">
        {sorted.map((category) => (
          <div key={category.id} className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full" style={{ backgroundColor: category.color }} />
                <div>
                  <p className="font-medium text-foreground">{category.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{category.type}</span>
                    {category.is_subscription && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">suscripcion</span>}
                    {category.is_default && <Star className="h-3 w-3" />}
                  </div>
                </div>
              </div>
              {!category.is_default && (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(category.id)} className="rounded-lg bg-muted p-2"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteCategory(category.id)} className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <BaseModalForm
          title={editingId ? "Editar categoria" : "Nueva categoria"}
          onClose={() => setShowModal(false)}
          footer={<button onClick={save} className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">Guardar</button>}
        >
          <div className="space-y-3 pb-safe-areas">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="h-12 w-full rounded-xl border border-border bg-background px-4" />
            <input value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="Icono" className="h-12 w-full rounded-xl border border-border bg-background px-4" />
            <input value={color} onChange={(event) => setColor(event.target.value)} placeholder="#64748b" className="h-12 w-full rounded-xl border border-border bg-background px-4" />
            <div className="flex gap-2">
              {(["expense", "income", "both"] as const).map((item) => (
                <button key={item} onClick={() => setType(item)} className={cn("flex-1 rounded-xl px-3 py-2 text-sm", type === item ? "bg-primary text-primary-foreground" : "bg-muted")}>{item}</button>
              ))}
            </div>
            <button onClick={() => setIsSubscription((prev) => !prev)} className={cn("h-11 w-full rounded-xl text-sm font-medium", isSubscription ? "bg-amber-500 text-white" : "bg-muted text-foreground")}>Marcar como categoria de suscripcion</button>
          </div>
        </BaseModalForm>
      )}
    </div>
  )
}
