"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { updateProfile, useProfile, useAccounts, useTransactions } from "@/hooks/use-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clearCompletedSteps } from "@/components/dashboard/activation-panel"
import { generateSmartNotifications, type SmartNotification } from "@/lib/smart-notifications"
import { showToast } from "@/components/toast/smart-toast"
import { useGoals } from "@/hooks/use-data"

const QA_EMAIL = "example@example.com"

export default function QaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { data: profile } = useProfile()
  const { data: accounts = [] } = useAccounts()
  const { data: transactions = [] } = useTransactions(120)
  const { data: goals = [] } = useGoals()

  const [email, setEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [previewNotifications, setPreviewNotifications] = useState<SmartNotification[]>([])

  useEffect(() => {
    let mounted = true
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setEmail(data.user?.email ?? null)
    }
    loadUser()
    return () => {
      mounted = false
    }
  }, [supabase])

  const isDev = process.env.NODE_ENV === "development"
  const isAllowed = isDev && email?.toLowerCase() === QA_EMAIL

  const setOnboarding = async (completed: boolean) => {
    setLoading(true)
    setStatus("")
    try {
      await updateProfile({ onboarding_completed: completed })
      if (typeof window !== "undefined") {
        window.localStorage.setItem("onboarding_completed", completed ? "true" : "false")
      }
      setStatus(completed ? "Onboarding completado." : "Onboarding pendiente.")
    } catch {
      setStatus("No se pudo actualizar onboarding.")
    } finally {
      setLoading(false)
    }
  }

  const clearLocalFlag = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("onboarding_completed")
      clearCompletedSteps()
    }
    setStatus("Flags limpiados (onboarding + activation steps).")
  }

  const loadDemoData = async () => {
    setLoadingData(true)
    setStatus("")
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setStatus("No se encontro usuario.")
      setLoadingData(false)
      return
    }

    try {
      const { data: existingAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1)

      if (existingAccounts && existingAccounts.length > 0) {
        setStatus("Ya tienes cuentas. Borra primero con 'Limpiar datos demo'.")
        setLoadingData(false)
        return
      }

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name")
        .eq("type", "expense")
        .limit(1)

      const categoryId = categoryData?.[0]?.id ?? null
      const today = new Date().toISOString().split("T")[0]

      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .insert({
          user_id: userId,
          name: "Efectivo RD",
          type: "cash",
          currency: "DOP",
          balance: 15000,
          icon: "banknote",
          color: "#10B981",
        })
        .select("id")
        .single()

      if (accountError || !accountData) {
        setStatus("Error creando cuenta: " + (accountError?.message ?? "desconocido"))
        setLoadingData(false)
        return
      }

      if (categoryId) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]

        await supabase.from("transactions").insert([
          {
            user_id: userId,
            account_id: accountData.id,
            category_id: categoryId,
            type: "expense",
            amount: 350,
            description: "Almuerzo",
            date: yesterdayStr,
            currency: "DOP",
          },
          {
            user_id: userId,
            account_id: accountData.id,
            category_id: categoryId,
            type: "expense",
            amount: 1200,
            description: "Supermercado",
            date: today,
            currency: "DOP",
          },
        ])
      }

      await supabase.from("goals").insert({
        user_id: userId,
        name: "Vacaciones RD",
        target_amount: 25000,
        current_amount: 10000,
        icon: "palm-tree",
        color: "#10B981",
      })

      clearCompletedSteps()
      setStatus("Datos demo cargados: 1 cuenta + 2 transacciones + 1 meta. Ve al dashboard.")
    } catch (err) {
      setStatus("Error: " + String(err))
    } finally {
      setLoadingData(false)
    }
  }

  const clearDemoData = async () => {
    setLoadingData(true)
    setStatus("")
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setStatus("No se encontro usuario.")
      setLoadingData(false)
      return
    }

    try {
      await supabase.from("goals").delete().eq("user_id", userId)
      await supabase.from("transactions").delete().eq("user_id", userId)
      await supabase.from("accounts").delete().eq("user_id", userId)
      clearCompletedSteps()
      setStatus("Todos los datos eliminados. Dashboard limpio.")
    } catch (err) {
      setStatus("Error: " + String(err))
    } finally {
      setLoadingData(false)
    }
  }

  if (!isDev) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>QA deshabilitado</CardTitle>
            <CardDescription>Solo funciona en desarrollo.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (!isAllowed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>Solo para {QA_EMAIL}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Usuario: {email ?? "sin sesion"}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-8 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Modo QA MiCuadre</CardTitle>
          <CardDescription>Usuario: {email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted p-3 text-xs space-y-1">
            <p>onboarding: {String(Boolean(profile?.onboarding_completed))}</p>
            <p>cuentas: {accounts.length}</p>
            <p>transacciones: {transactions.length}</p>
            <p>Activacion: {accounts.length === 0 && transactions.length === 0 ? "PANEL VISIBLE" : "panel oculto"}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">ONBOARDING</p>
            <div className="grid gap-2">
              <Button size="sm" disabled={loading} onClick={() => setOnboarding(false)}>
                Onboarding pendiente
              </Button>
              <Button size="sm" variant="secondary" disabled={loading} onClick={() => setOnboarding(true)}>
                Onboarding completado
              </Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={clearLocalFlag}>
                Limpiar flags
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">DATOS DEMO (para activar panel)</p>
            <div className="grid gap-2">
              <Button size="sm" variant="outline" disabled={loadingData} onClick={loadDemoData}>
                {loadingData ? "Cargando..." : "Cargar datos demo"}
              </Button>
              <Button size="sm" variant="outline" disabled={loadingData} onClick={clearDemoData}>
                {loadingData ? "Limpiando..." : "Limpiar datos demo"}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">NAVEGACION</p>
            <div className="grid gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push("/onboarding")}>
                Ir a onboarding
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push("/dashboard")}>
                Ir a dashboard
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">SMART NOTIFICATIONS</p>
            <Button size="sm" variant="outline" onClick={() => {
              const generated = generateSmartNotifications(transactions, accounts, goals)
              setPreviewNotifications(generated)
            }}>
              Generar preview de notificaciones
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              showToast({ title: "Racha activa", body: "Llevas 5 días trackeando. ¡No pares!", type: "success", duration: 2500 })
            }}>
              Probar: Daily Reminder
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              showToast({ title: "Comida lidera tus gastos", body: "Esta semana has gastado RD$8,500 en comida, el 42% de tus gastos.", type: "info", duration: 3000 })
            }}>
              Probar: Spending Insight
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              showToast({ title: "Casi llegas a tu meta", body: "Vacaciones RD: 75% completado. ¡Ya casi!", type: "success", duration: 2500 })
            }}>
              Probar: Goal Progress
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              showToast({ title: "Corte de tarjeta en 3 dias", body: "Tu Banreservas corta pronto. Revisa los consumos.", type: "warning", duration: 3000 })
            }}>
              Probar: Credit Cutoff
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              showToast({ title: "Pago de tarjeta pendiente", body: "Banreservas: RD$5,200 pendiente. No olvides pagar.", type: "warning", duration: 3000 })
            }}>
              Probar: Credit Payment
            </Button>
            {previewNotifications.length > 0 ? (
              <div className="mt-2 space-y-2">
                {previewNotifications.map((n) => (
                  <div key={n.id} className="rounded-xl border bg-card p-3 text-xs">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{n.body}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => showToast({ title: n.title, body: n.body, type: n.priority === "high" ? "warning" : n.priority === "medium" ? "info" : "default", duration: 3000 })}
                        className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                      >
                        Ver como toast
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] uppercase text-muted-foreground">[{n.priority}] {n.type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sin notificaciones generadas</p>
            )}
          </div>

          {status ? (
            <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">{status}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
