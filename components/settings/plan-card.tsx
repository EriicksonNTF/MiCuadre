"use client"

import { CreditCard, RefreshCw, Sparkles, Crown, DownloadCloud, RotateCcw } from "lucide-react"
import type { PlanTier } from "@/types/billing"
import { PlanBadge } from "@/components/entitlements/plan-badge"
import { SettingsGroup } from "@/components/settings/settings-group"
import { SettingsRow } from "@/components/settings/settings-row"

type BillingPlanStatus = "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "incomplete"

type PlanCardProps = {
  plan: PlanTier
  readablePlanStatus: string
  canManagePlan: boolean
  canExport: boolean
  billingPlanStatus?: BillingPlanStatus | null
  onOpenPlanSelector: () => void
  onOpenBillingPortal: () => void
  onVerifyPlan: () => void
  onExportCsv: () => void
  onRestorePurchases: () => void
  isOpeningPortal?: boolean
  isVerifyingPlan?: boolean
  isExportingCsv?: boolean
  isRestoringPurchases?: boolean
}

const VERIFY_STATUS_HINTS: BillingPlanStatus[] = ["past_due", "incomplete", "unpaid"]

export function PlanCard({
  plan,
  readablePlanStatus,
  canManagePlan,
  canExport,
  billingPlanStatus,
  onOpenPlanSelector,
  onOpenBillingPortal,
  onVerifyPlan,
  onExportCsv,
  onRestorePurchases,
  isOpeningPortal,
  isVerifyingPlan,
  isExportingCsv,
  isRestoringPurchases,
}: PlanCardProps) {
  const showVerify = billingPlanStatus
    ? VERIFY_STATUS_HINTS.includes(billingPlanStatus)
    : false
  const isPro = plan === "pro"

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Plan actual</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Estado: {readablePlanStatus}</p>
        </div>
        <PlanBadge plan={plan} />
      </div>

      <p className="mt-3 rounded-xl bg-muted/35 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
        {isPro ? "Acceso completo activo." : "Estás usando el plan gratis."}
      </p>
    </div>
  )
}

export function PlanCardActions({
  canManagePlan,
  canExport,
  showVerify,
  onOpenPlanSelector,
  onOpenBillingPortal,
  onVerifyPlan,
  onExportCsv,
  onRestorePurchases,
  isOpeningPortal,
  isVerifyingPlan,
  isExportingCsv,
  isRestoringPurchases,
}: Pick<
  PlanCardProps,
  | "canManagePlan"
  | "canExport"
  | "onOpenPlanSelector"
  | "onOpenBillingPortal"
  | "onVerifyPlan"
  | "onExportCsv"
  | "onRestorePurchases"
  | "isOpeningPortal"
  | "isVerifyingPlan"
  | "isExportingCsv"
  | "isRestoringPurchases"
> & { showVerify: boolean }) {
  return (
    <div className="mt-2 space-y-3">
      <SettingsGroup divided={false} className="bg-transparent border-0">
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={onOpenPlanSelector}
            className="tap-lift flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Ver planes
          </button>
        </div>
      </SettingsGroup>

      <SettingsGroup>
        {canManagePlan ? (
          <SettingsRow
            icon={CreditCard}
            title="Gestionar plan"
            description="Abrir portal de facturación"
            onClick={onOpenBillingPortal}
            disabled={isOpeningPortal}
            trailingLabel={isOpeningPortal ? "Abriendo..." : undefined}
          />
        ) : null}
        {showVerify ? (
          <SettingsRow
            icon={RefreshCw}
            iconClassName={isVerifyingPlan ? "animate-spin" : undefined}
            title="Verificar estado"
            description="Re-sincronizar con Stripe"
            onClick={onVerifyPlan}
            disabled={isVerifyingPlan}
            trailingLabel={isVerifyingPlan ? "Verificando..." : undefined}
          />
        ) : null}
        <SettingsRow
          icon={DownloadCloud}
          title="Exportar a CSV"
          description={canExport ? "Descarga todas tus transacciones" : "Disponible en MiCuadre Pro"}
          onClick={onExportCsv}
          disabled={!canExport || isExportingCsv}
          locked={!canExport}
          trailingLabel={isExportingCsv ? "Descargando..." : undefined}
        />
        <SettingsRow
          icon={RotateCcw}
          title="Restaurar compras"
          description="Volver a verificar tu plan"
          onClick={onRestorePurchases}
          disabled={isRestoringPurchases}
          trailingLabel={isRestoringPurchases ? "Restaurando..." : undefined}
        />
        {!canExport ? (
          <div className="px-4 pb-3 pt-1 text-[0.6875rem] text-muted-foreground">
            <Crown className="mr-1 inline-block h-3 w-3" aria-hidden />
            La exportación a CSV está incluida en MiCuadre Pro.
          </div>
        ) : null}
      </SettingsGroup>
    </div>
  )
}
