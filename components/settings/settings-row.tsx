"use client"

import Link from "next/link"
import { ChevronRight, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"

type SettingsRowProps = {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  iconClassName?: string
  title: string
  description?: string
  trailing?: React.ReactNode
  trailingLabel?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  locked?: boolean
  destructive?: boolean
  className?: string
  controlId?: string
  switchValue?: boolean
  onSwitchChange?: (checked: boolean) => void
  switchAriaLabel?: string
}

export function SettingsRow({
  icon: Icon,
  iconClassName,
  title,
  description,
  trailing,
  trailingLabel,
  href,
  onClick,
  disabled = false,
  locked = false,
  destructive = false,
  className,
  controlId,
  switchValue,
  onSwitchChange,
  switchAriaLabel,
}: SettingsRowProps) {
  const isSwitchRow = typeof switchValue === "boolean" && onSwitchChange
  const interactive = Boolean(href || onClick) && !disabled && !isSwitchRow
  const titleClass = destructive
    ? "font-medium text-destructive"
    : "font-medium text-foreground"

  const body = (
    <div className={cn("flex min-h-[56px] items-center gap-3 px-4 py-3", className)}>
      {Icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            destructive ? "bg-destructive/10" : "bg-muted"
          )}
        >
          <Icon className={cn("h-5 w-5", destructive ? "text-destructive" : "text-foreground")} aria-hidden />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={titleClass}>{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {isSwitchRow ? (
        <Switch
          id={controlId}
          checked={switchValue as boolean}
          onCheckedChange={onSwitchChange}
          aria-label={switchAriaLabel || title}
        />
      ) : locked ? (
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          {trailing}
          {trailingLabel ? (
            <span className="text-sm">{trailingLabel}</span>
          ) : null}
          {interactive ? (
            <ChevronRight className="h-5 w-5" aria-hidden />
          ) : null}
        </div>
      )}
    </div>
  )

  if (isSwitchRow) {
    return (
      <div
        className={cn("block", disabled && "pointer-events-none opacity-60")}
        onClick={(event) => {
          if (!interactive) return
          if (event.target instanceof HTMLElement && event.target.closest("[data-switch]")) return
        }}
      >
        <label
          htmlFor={controlId}
          className={cn("block cursor-pointer", disabled && "cursor-not-allowed")}
        >
          {body}
        </label>
      </div>
    )
  }

  if (href && !disabled) {
    return (
      <Link href={href} className="tap-lift block">
        {body}
      </Link>
    )
  }

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="tap-lift block w-full text-left"
        aria-label={title}
      >
        {body}
      </button>
    )
  }

  return <div className={cn("block", disabled && "opacity-60")}>{body}</div>
}
