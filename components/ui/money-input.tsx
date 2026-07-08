"use client"

import CurrencyInput from "react-currency-input-field"
import { cn } from "@/lib/utils"

export function MoneyInput({
  value,
  onValueChange,
  className,
  wrapperClassName,
  placeholder = "0.00",
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
  return (
    <div className={cn("min-w-0 overflow-x-auto scrollbar-none", wrapperClassName)}>
      <CurrencyInput
        id={id}
        name={id}
        placeholder={placeholder}
        value={value || undefined}
        decimalsLimit={2}
        decimalScale={2}
        fixedDecimalLength={2}
        allowNegativeValue={false}
        groupSeparator=","
        decimalSeparator="."
        className={className}
        inputMode="decimal"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onValueChange={(val) => {
          onValueChange(val ?? "")
        }}
      />
    </div>
  )
}
