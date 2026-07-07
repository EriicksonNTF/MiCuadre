import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GLOBAL_ACCOUNTS } from "./constants"
import type { EntryType, Currency } from "./constants"

type LedgerEntryInput = {
  userId: string
  debitAccountId: string
  creditAccountId: string
  amount: number
  currency: Currency
  description?: string
  entryType: EntryType
  referenceId?: string
  referenceTable?: string
}

export class LedgerService {
  private supabase: SupabaseClient

  constructor(existingClient?: SupabaseClient) {
    this.supabase = existingClient || createClient()
  }

  async recordEntry(input: LedgerEntryInput) {
    const { error } = await this.supabase.from("ledger_entries").insert({
      user_id: input.userId,
      debit_account_id: input.debitAccountId,
      credit_account_id: input.creditAccountId,
      amount: input.amount,
      currency: input.currency,
      description: input.description || null,
      entry_type: input.entryType,
      reference_id: input.referenceId || null,
      reference_table: input.referenceTable || null,
    })
    if (error) throw error
  }

  async recordExpense(
    userId: string,
    accountId: string,
    amount: number,
    currency: Currency,
    description?: string,
    referenceId?: string,
    referenceTable?: string,
  ) {
    const { data: account } = await this.supabase
      .from("accounts")
      .select("type")
      .eq("id", accountId)
      .maybeSingle()

    if (account?.type === "credit") {
      await this.recordEntry({
        userId,
        debitAccountId: GLOBAL_ACCOUNTS.EXPENSE,
        creditAccountId: accountId,
        amount,
        currency,
        description,
        entryType: "expense",
        referenceId,
        referenceTable,
      })
    } else {
      await this.recordEntry({
        userId,
        debitAccountId: accountId,
        creditAccountId: GLOBAL_ACCOUNTS.EXPENSE,
        amount,
        currency,
        description,
        entryType: "expense",
        referenceId,
        referenceTable,
      })
    }
  }

  async recordIncome(
    userId: string,
    accountId: string,
    amount: number,
    currency: Currency,
    description?: string,
    referenceId?: string,
    referenceTable?: string,
  ) {
    await this.recordEntry({
      userId,
      debitAccountId: GLOBAL_ACCOUNTS.INCOME,
      creditAccountId: accountId,
      amount,
      currency,
      description,
      entryType: "income",
      referenceId,
      referenceTable,
    })
  }

  async recordTransfer(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    currency: Currency,
    description?: string,
    transferId?: string,
  ) {
    const refId = transferId || crypto.randomUUID()
    await this.recordEntry({
      userId,
      debitAccountId: fromAccountId,
      creditAccountId: GLOBAL_ACCOUNTS.EXPENSE,
      amount,
      currency,
      description: description ? `${description} (enviado)` : "Transferencia enviada",
      entryType: "transfer",
      referenceId: refId,
      referenceTable: "transfers_debit",
    })

    const { data: destAccount } = await this.supabase
      .from("accounts")
      .select("type")
      .eq("id", toAccountId)
      .maybeSingle()

    if (destAccount?.type === "credit") {
      await this.recordEntry({
        userId,
        debitAccountId: toAccountId,
        creditAccountId: GLOBAL_ACCOUNTS.INCOME,
        amount,
        currency,
        description: description ? `${description} (pago a tarjeta)` : "Pago a tarjeta de crédito",
        entryType: "transfer",
        referenceId: refId,
        referenceTable: "transfers_credit",
      })
    } else {
      await this.recordEntry({
        userId,
        debitAccountId: GLOBAL_ACCOUNTS.INCOME,
        creditAccountId: toAccountId,
        amount,
        currency,
        description: description ? `${description} (recibido)` : "Transferencia recibida",
        entryType: "transfer",
        referenceId: refId,
        referenceTable: "transfers_credit",
      })
    }
  }

  async recordCreditPayment(
    userId: string,
    sourceAccountId: string,
    creditAccountId: string,
    amount: number,
    currency: Currency,
    paymentId?: string,
  ) {
    const refId = paymentId || crypto.randomUUID()
    await this.recordEntry({
      userId,
      debitAccountId: sourceAccountId,
      creditAccountId: GLOBAL_ACCOUNTS.EXPENSE,
      amount,
      currency,
      description: "Pago a tarjeta de crédito",
      entryType: "credit_payment",
      referenceId: refId,
      referenceTable: "credit_payments_debit",
    })
    await this.recordEntry({
      userId,
      debitAccountId: creditAccountId,
      creditAccountId: GLOBAL_ACCOUNTS.INCOME,
      amount,
      currency,
      description: "Reducción de deuda por pago de tarjeta",
      entryType: "credit_payment",
      referenceId: refId,
      referenceTable: "credit_payments_credit",
    })
  }

  async recordGoalContribution(
    userId: string,
    accountId: string,
    amount: number,
    currency: Currency,
    goalId: string,
  ) {
    await this.recordEntry({
      userId,
      debitAccountId: accountId,
      creditAccountId: GLOBAL_ACCOUNTS.EXPENSE,
      amount,
      currency,
      description: "Aporte a meta de ahorro",
      entryType: "goal_contribution",
      referenceId: goalId,
      referenceTable: "goal_contributions",
    })
  }

  async recordCommission(
    userId: string,
    accountId: string,
    amount: number,
    currency: Currency,
    description?: string,
  ) {
    await this.recordEntry({
      userId,
      debitAccountId: accountId,
      creditAccountId: GLOBAL_ACCOUNTS.EXPENSE,
      amount,
      currency,
      description: description || "Comisión",
      entryType: "commission",
    })
  }

  async reverseTransactionEntries(referenceId: string, referenceTable: string, userId: string) {
    const { data: entries, error } = await this.supabase
      .from("ledger_entries")
      .select("id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table")
      .eq("reference_id", referenceId)
      .eq("reference_table", referenceTable)

    if (error || !entries?.length) return

    const reversalEntries = entries.map((entry) => ({
      user_id: userId,
      debit_account_id: entry.credit_account_id,
      credit_account_id: entry.debit_account_id,
      amount: entry.amount,
      currency: entry.currency,
      description: `Reversión: ${entry.description || ""}`,
      entry_type: entry.entry_type,
      reference_id: entry.reference_id,
      reference_table: `reversed_${entry.reference_table}`,
    }))

    const { error: insertError } = await this.supabase
      .from("ledger_entries")
      .insert(reversalEntries)

    if (insertError) throw insertError
  }

  async calcBalance(accountId: string): Promise<number> {
    const { data, error } = await this.supabase
      .rpc("ledger_calc_balance", { p_account_id: accountId })

    if (error) throw error
    return Number(data || 0)
  }

  async checkConsistency(accountId: string): Promise<{
    storedBalance: number
    ledgerBalance: number
    discrepancy: number
    consistent: boolean
  }> {
    const { data, error } = await this.supabase
      .rpc("ledger_check_account", { p_account_id: accountId })

    if (error) throw error
    return {
      storedBalance: Number(data.stored_balance),
      ledgerBalance: Number(data.ledger_balance),
      discrepancy: Number(data.discrepancy),
      consistent: Boolean(data.consistent),
    }
  }

  async reconcileAccount(accountId: string) {
    const check = await this.checkConsistency(accountId)
    if (check.consistent) return check

    const { data: account } = await this.supabase
      .from("accounts")
      .select("id, type, currency")
      .eq("id", accountId)
      .single()

    if (!account) throw new Error("Cuenta no encontrada")

    if (account.type === "credit") {
      const currency = (account.currency || "DOP") as Currency
      const debtField = currency === "USD" ? "current_debt_usd" : "current_debt_dop"
      await this.supabase
        .from("accounts")
        .update({ [debtField]: check.ledgerBalance, current_debt: check.ledgerBalance })
        .eq("id", accountId)
    } else {
      await this.supabase
        .from("accounts")
        .update({ balance: check.ledgerBalance })
        .eq("id", accountId)
    }

    return { ...check, corrected: true }
  }

  async getFeeRate(planTier: string, appliesTo: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("fee_rules")
      .select("value")
      .eq("plan_tier", planTier)
      .eq("rule_name", "commission_rate")
      .eq("applies_to", appliesTo)
      .eq("active", true)
      .single()

    if (error || !data) return 0.0015
    return Number(data.value)
  }

  async getLateFeeRate(planTier: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("fee_rules")
      .select("value")
      .eq("plan_tier", planTier)
      .eq("rule_name", "late_fee_rate")
      .eq("applies_to", "late_payment")
      .eq("active", true)
      .single()

    if (error || !data) return 0.12
    return Number(data.value)
  }

  static create(client?: SupabaseClient): LedgerService {
    return new LedgerService(client)
  }
}
