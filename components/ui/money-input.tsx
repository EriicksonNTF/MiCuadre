"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { formatAmount } from "@/lib/data"

function sanitize(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 1) return parts[0]
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`
}

export function MoneyInput({
  value,
  onValueChange,
  className,
  wrapperClassName,
  placeholder,
  autoFocus,
  id,
  "aria-label": ariaLabel = "Monto",
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
  wrapperClassName?: string
  placeholder?: string
  autoFocus?: boolean
  id?: string
  "aria-label"?: string
}) {
  const displayValue = useMemo(() => {
    const normalized = sanitize(value)
    if (!normalized) return ""
    const [intPart, decPart] = normalized.split(".")
    const intFormatted = intPart ? formatAmount(Number(intPart)) : "0"
    return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted
  }, [value])

  return (
    <div className={cn("min-w-0 overflow-x-auto scrollbar-none", wrapperClassName)}>
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(event) => onValueChange(sanitize(event.target.value))}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        id={id}
        aria-label={ariaLabel}
      />
    </div>
  )
}
