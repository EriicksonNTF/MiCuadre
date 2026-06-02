import type { Account, CreditCardCycle } from "@/lib/types/database"

export type CardFinancialSnapshot = {
  cards: CardInfo[]
  hasCards: boolean
  totalDebtDop: number
  totalDebtUsd: number
  totalCreditLimitDop: number
  totalCreditLimitUsd: number
}

export type CardInfo = {
  id: string
  name: string
  currency: "DOP" | "USD"
  bankName: string | null
  currentBalanceDop: number
  currentBalanceUsd: number
  creditLimitDop: number
  creditLimitUsd: number
  availableCreditDop: number
  availableCreditUsd: number
  currentDebtDop: number
  currentDebtUsd: number
  statementBalanceDop: number
  statementBalanceUsd: number
  financedBalanceDop: number
  financedBalanceUsd: number
  paidStatementAmountDop: number
  paidStatementAmountUsd: number
  pendingTransitDop: number
  pendingTransitUsd: number
  minimumPaymentPercentage: number
  annualInterestRate: number
  closingDay: number | null
  dueDaysAfterCutoff: number | null
  lastStatementCutoffDate: string | null
  statementDueDate: string | null
  cycles: CreditCardCycle[]
}

function safeNumber(value: number | null | undefined): number {
  return Number(value ?? 0)
}

function buildCardInfo(account: Account, cycles: CreditCardCycle[]): CardInfo {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency as "DOP" | "USD",
    bankName: account.bank_name ?? null,
    currentBalanceDop: safeNumber(account.current_balance_dop),
    currentBalanceUsd: safeNumber(account.current_balance_usd),
    creditLimitDop: safeNumber(account.credit_limit_dop),
    creditLimitUsd: safeNumber(account.credit_limit_usd),
    availableCreditDop: safeNumber(account.available_credit_dop),
    availableCreditUsd: safeNumber(account.available_credit_usd),
    currentDebtDop: safeNumber(account.current_debt_dop),
    currentDebtUsd: safeNumber(account.current_debt_usd),
    statementBalanceDop: safeNumber(account.statement_balance_dop),
    statementBalanceUsd: safeNumber(account.statement_balance_usd),
    financedBalanceDop: safeNumber(account.financed_balance_dop),
    financedBalanceUsd: safeNumber(account.financed_balance_usd),
    paidStatementAmountDop: safeNumber(account.paid_statement_amount_dop),
    paidStatementAmountUsd: safeNumber(account.paid_statement_amount_usd),
    pendingTransitDop: safeNumber(account.pending_transit_dop),
    pendingTransitUsd: safeNumber(account.pending_transit_usd),
    minimumPaymentPercentage: safeNumber(account.minimum_payment_percentage),
    annualInterestRate: safeNumber(account.annual_interest_rate),
    closingDay: account.closing_day,
    dueDaysAfterCutoff: account.due_days_after_cutoff,
    lastStatementCutoffDate: account.last_statement_cutoff_date,
    statementDueDate: account.statement_due_date,
    cycles,
  }
}

export async function buildCardSnapshot(
  supabase: any,
  userId: string,
): Promise<CardFinancialSnapshot> {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "credit")
    .eq("is_active", true)

  const allAccounts: Account[] = accounts ?? []

  const accountIds = allAccounts.map((a) => a.id)
  const cycles: CreditCardCycle[] = []

  if (accountIds.length > 0) {
    const { data: cycleData } = await supabase
      .from("credit_card_cycles")
      .select("*")
      .in("account_id", accountIds)
      .order("created_at", { ascending: false })

    if (cycleData) {
      cycles.push(...(cycleData as CreditCardCycle[]))
    }
  }

  const cards = allAccounts.map((account) => {
    const cardCycles = cycles.filter((c) => c.account_id === account.id)
    return buildCardInfo(account, cardCycles)
  })

  const totalDebtDop = cards.reduce((sum, c) => sum + c.currentDebtDop, 0)
  const totalDebtUsd = cards.reduce((sum, c) => sum + c.currentDebtUsd, 0)
  const totalCreditLimitDop = cards.reduce((sum, c) => sum + c.creditLimitDop, 0)
  const totalCreditLimitUsd = cards.reduce((sum, c) => sum + c.creditLimitUsd, 0)

  return {
    cards,
    hasCards: cards.length > 0,
    totalDebtDop,
    totalDebtUsd,
    totalCreditLimitDop,
    totalCreditLimitUsd,
  }
}
