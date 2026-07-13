import { useRef, type ComponentType, type HTMLAttributes, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { mutate } from "swr"

import { cn } from "@/lib/utils"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { PullToRefreshIndicator } from "@/components/pull-to-refresh"
import { useIsMobile } from "@/components/ui/use-mobile"

type MobilePageShellProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: "main" | "div" | "section"
  /** Remove inner .mobile-page container for edge-to-edge layouts (camera, scan, expense) */
  fullBleed?: boolean
  /** Remove bottom-nav safe-area padding for auth pages, onboarding, or sidebar mode */
  noBottomNav?: boolean
}

function MobilePageShell({
  as: Comp = "main",
  className,
  children,
  fullBleed,
  noBottomNav,
  ...props
}: MobilePageShellProps) {
  const scrollRef = useRef<HTMLElement>(null)
  const isMobile = useIsMobile()

  async function refreshAllData() {
    const stringKeys = [
      "accounts",
      "profile",
      "goals",
      "categories",
      "notifications",
      "beneficiaries",
      "financial_subscriptions",
      "notification_preferences",
      "planning_budgets_with_usage",
      "planning_calendar_events",
      "planning_debts",
      "planning_debt_payments_month",
      "planning_credit_card_debts",
      "billing_status",
    ]
    await Promise.all([
      ...stringKeys.map((key) => mutate(key, undefined, { revalidate: true })),
      mutate(
        (key: unknown) => Array.isArray(key) && (key[0] === "transactions" || key[0] === "transfers"),
        undefined,
        { revalidate: true },
      ),
    ])
  }

  const { distance, status } = usePullToRefresh(scrollRef, {
    onRefresh: refreshAllData,
    enabled: isMobile,
    threshold: 70,
    maxPull: 100,
  })

  return (
    <Comp
      ref={scrollRef as React.RefObject<HTMLDivElement>}
      className={cn("app-scroll h-[100dvh] overflow-y-auto bg-background", className)}
      {...props}
    >
      {isMobile && <PullToRefreshIndicator distance={distance} status={status} threshold={70} />}
      {fullBleed ? children : (
        <div className={cn("mobile-page", noBottomNav && "mobile-page--no-nav")}>
          {children}
        </div>
      )}
    </Comp>
  )
}

function MobileCard({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn("mobile-card p-5", className)} {...props}>
      {children}
    </section>
  )
}

type MobileSectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

function MobileSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
  ...props
}: MobileSectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div className="min-w-0">
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <h2 className="mt-1 text-lg font-black leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function StickyFormFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 border-t border-border/55 bg-card/92 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-18px_45px_-34px_rgba(0,0,0,0.38)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function IconBadge({
  icon: Icon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <div className={cn("mobile-icon-badge", className)} {...props}>
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : children}
    </div>
  )
}

function FinancialAmount({
  value,
  label,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  value: ReactNode
  label?: string
}) {
  return (
    <div className={cn("min-w-0", className)} {...props}>
      {label ? <p className="text-xs font-semibold text-muted-foreground">{label}</p> : null}
      <p className="mt-1 break-words text-3xl font-black leading-none tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  action,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <MobileCard className={cn("text-center", className)} {...props}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </MobileCard>
  )
}

function LoadingState({
  label = "Cargando",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label?: string
}) {
  return (
    <div
      className={cn("flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground", className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}

function AlertCard({
  title,
  description,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string
  description?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200",
        className,
      )}
      role="status"
      {...props}
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          {description ? <p className="mt-1 text-sm leading-relaxed opacity-90">{description}</p> : null}
          {children}
        </div>
      </div>
    </div>
  )
}

export {
  AlertCard,
  EmptyState,
  FinancialAmount,
  IconBadge,
  LoadingState,
  MobileCard,
  MobilePageShell,
  MobileSectionHeader,
  StickyFormFooter,
}
