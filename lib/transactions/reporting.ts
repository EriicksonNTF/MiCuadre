export function isInternalTransfer(metadata?: Record<string, unknown> | null) {
  return metadata?.kind === "transfer" && metadata?.transfer_type === "internal"
}

export function isExcludedFromRealIncome(metadata?: Record<string, unknown> | null) {
  return (
    metadata?.kind === "credit_payment" ||
    (metadata?.kind === "credit_card_income" && metadata?.reporting_treatment === "exclude_from_income")
  )
}

export function isReportableIncome(metadata?: Record<string, unknown> | null) {
  return !isInternalTransfer(metadata) && !isExcludedFromRealIncome(metadata)
}

export function isReportableExpense(metadata?: Record<string, unknown> | null) {
  return !isInternalTransfer(metadata) && metadata?.kind !== "credit_payment"
}
