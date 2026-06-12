"use client"

import Link from "next/link"
import { Bell, BellOff, ChevronLeft } from "lucide-react"
import { useNotificationPreferences } from "@/hooks/use-data"
import { notify } from "@/lib/notifications"
import { SettingsGroup } from "@/components/settings/settings-group"
import { SettingsRow } from "@/components/settings/settings-row"
import { MobilePageShell } from "@/components/ui/mobile-foundation"

const PREFERENCE_ROWS = [
  {
    key: "transactions" as const,
    title: "Transacciones",
    description: "Notificar nuevos gastos e ingresos",
  },
  {
    key: "budgets" as const,
    title: "Presupuestos",
    description: "Alertas y progreso por categoría",
  },
  {
    key: "creditAlerts" as const,
    title: "Alertas de tarjeta",
    description: "Fechas de corte y pagos",
  },
  {
    key: "marketing" as const,
    title: "Promociones",
    description: "Ofertas y novedades",
  },
] as const

export function NotificationsScreen() {
  const { data, isLoading, setPreference } = useNotificationPreferences()

  async function toggle(key: (typeof PREFERENCE_ROWS)[number]["key"], next: boolean) {
    try {
      await setPreference(key, next)
    } catch (error) {
      notify({
        title: "No se pudo guardar",
        message: error instanceof Error ? error.message : "Intenta de nuevo en unos segundos.",
      })
    }
  }

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border/55 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-4 px-5 py-4">
          <Link
            href="/settings"
            className="tap-lift flex h-10 w-10 items-center justify-center rounded-full bg-muted/85"
            aria-label="Volver a Ajustes"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" aria-hidden />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notificaciones</p>
            <h1 className="text-lg font-black tracking-tight text-foreground">Preferencias</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-6 px-5 pt-6">
        <p className="text-sm text-muted-foreground">
          Elige qué tipo de avisos quieres recibir dentro de la app. La activación general de notificaciones push se gestiona desde tu dispositivo.
        </p>

        <SettingsGroup>
          {PREFERENCE_ROWS.map((row) => {
            const value = data?.[row.key] ?? true
            const Icon = value ? Bell : BellOff
            return (
              <SettingsRow
                key={row.key}
                icon={Icon}
                title={row.title}
                description={row.description}
                controlId={`notif-${row.key}`}
                switchValue={value}
                onSwitchChange={(checked) => toggle(row.key, checked)}
                switchAriaLabel={`${row.title} (notificación)`}
                disabled={isLoading}
              />
            )
          })}
        </SettingsGroup>
      </div>
    </MobilePageShell>
  )
}
