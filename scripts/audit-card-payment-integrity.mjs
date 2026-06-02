#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js"

function parseArgs(argv) {
  const args = { dryRun: true, apply: false, user: null, email: null, card: null }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--apply") {
      args.apply = true
      args.dryRun = false
    } else if (token === "--dry-run") {
      args.dryRun = true
      args.apply = false
    } else if (token === "--user") {
      args.user = argv[i + 1] || null
      i += 1
    } else if (token === "--card") {
      args.card = argv[i + 1] || null
      i += 1
    } else if (token === "--email") {
      args.email = argv[i + 1] || null
      i += 1
    }
  }
  return args
}

function maskId(value) {
  if (!value) return "N/A"
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function getPaymentLinkId(metadata) {
  if (!metadata || typeof metadata !== "object") return null
  return metadata.payment_group_id || metadata.payment_id || null
}

function getIssueRisk(issueType) {
  if (["missing_card_credit", "missing_source_debit", "amount_mismatch", "currency_mismatch"].includes(issueType)) return "high"
  if (["orphan_notification", "duplicate_pair"].includes(issueType)) return "medium"
  return "low"
}

function recommendedFix(issueType) {
  switch (issueType) {
    case "missing_card_credit":
      return "Recrear movimiento de crédito en tarjeta y recalcular deuda solo si no fue ya ajustada"
    case "missing_source_debit":
      return "Recrear débito de cuenta origen si metadata/source_account_id es confiable; si no, revisión manual"
    case "amount_mismatch":
      return "Revertir grupo y reaplicar pago con función oficial"
    case "currency_mismatch":
      return "Revisión manual multi-moneda y corrección con dry-run previo"
    case "duplicate_pair":
      return "Conservar par más consistente y marcar duplicados para revisión manual"
    case "orphan_notification":
      return "Eliminar o reconciliar notificación de pago inexistente"
    default:
      return "Revisión manual"
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })

  let targetUserId = args.user
  if (!targetUserId && args.email) {
    const { data: profileByEmail, error: profileError } = await supabase
      .from("profiles")
      .select("id,email")
      .ilike("email", args.email)
      .limit(1)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profileByEmail?.id) {
      console.error(`No se encontró usuario para email ${args.email}`)
      process.exit(1)
    }
    targetUserId = profileByEmail.id
  }

  let txQuery = supabase
    .from("transactions")
    .select("id,user_id,account_id,type,amount,currency,date,metadata,created_at")
    .or("metadata->>kind.eq.credit_payment,metadata->>operation_type.eq.credit_card_payment")

  if (targetUserId) txQuery = txQuery.eq("user_id", targetUserId)

  const { data: transactions, error: txError } = await txQuery
  if (txError) throw txError

  const { data: accounts, error: accError } = await supabase
    .from("accounts")
    .select("id,user_id,type,name")

  if (accError) throw accError

  const accountById = new Map((accounts || []).map((a) => [a.id, a]))

  const filteredTransactions = (transactions || []).filter((tx) => {
    const metadata = tx.metadata || {}
    const cardId = metadata.credit_card_id || metadata.credit_account_id || (accountById.get(tx.account_id)?.type === "credit" ? tx.account_id : null)
    if (args.card && cardId !== args.card) return false
    return true
  })

  const byGroup = new Map()
  for (const tx of filteredTransactions) {
    const linkId = getPaymentLinkId(tx.metadata) || `orphan-${tx.id}`
    if (!byGroup.has(linkId)) byGroup.set(linkId, [])
    byGroup.get(linkId).push(tx)
  }

  const issues = []
  for (const [groupId, groupTxs] of byGroup.entries()) {
    const sourceSide = groupTxs.filter((tx) => tx.type === "expense")
    const cardSide = groupTxs.filter((tx) => tx.type === "income")
    const source = sourceSide[0] || null
    const card = cardSide[0] || null
    const sourceCurrency = source?.currency || source?.metadata?.source_currency || null
    const targetCurrency = card?.currency || source?.metadata?.payment_currency || null
    const exchangeRate = source?.metadata?.exchange_rate || card?.metadata?.exchange_rate || null

    if (!source && card) {
      issues.push({
        user_id: card.user_id,
        card_id: card.metadata?.credit_card_id || card.metadata?.credit_account_id || card.account_id,
        payment_group_id: groupId,
        issue_type: "missing_source_debit",
        source_account_transaction_id: null,
        card_transaction_id: card.id,
        amount: Number(card.amount || 0),
        currency: card.currency,
      })
    }

    if (source && !card) {
      issues.push({
        user_id: source.user_id,
        card_id: source.metadata?.credit_card_id || source.metadata?.credit_account_id || null,
        payment_group_id: groupId,
        issue_type: "missing_card_credit",
        source_account_transaction_id: source.id,
        card_transaction_id: null,
        amount: Number(source.amount || 0),
        currency: source.currency,
      })
    }

    if (source && card) {
      if (Number(source.amount || 0) !== Number(card.amount || 0)) {
        issues.push({
          user_id: source.user_id,
          card_id: card.metadata?.credit_card_id || card.metadata?.credit_account_id || card.account_id,
          payment_group_id: groupId,
          issue_type: "amount_mismatch",
          source_account_transaction_id: source.id,
          card_transaction_id: card.id,
          amount: `${source.amount} vs ${card.amount}`,
          currency: `${source.currency}/${card.currency}`,
        })
      }

      if (source.currency !== card.currency) {
        issues.push({
          user_id: source.user_id,
          card_id: card.metadata?.credit_card_id || card.metadata?.credit_account_id || card.account_id,
          payment_group_id: groupId,
          issue_type: "currency_mismatch",
          source_account_transaction_id: source.id,
          card_transaction_id: card.id,
          amount: Number(source.amount || 0),
          currency: `${source.currency}/${card.currency}`,
        })
      }

      if (sourceCurrency && targetCurrency && sourceCurrency !== targetCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) {
        issues.push({
          user_id: source.user_id,
          card_id: card.metadata?.credit_card_id || card.metadata?.credit_account_id || card.account_id,
          payment_group_id: groupId,
          issue_type: "missing_exchange_rate",
          source_account_transaction_id: source.id,
          card_transaction_id: card.id,
          amount: Number(source.amount || 0),
          currency: `${sourceCurrency}/${targetCurrency}`,
        })
      }

      if (groupTxs.length > 2) {
        issues.push({
          user_id: source.user_id,
          card_id: card.metadata?.credit_card_id || card.metadata?.credit_account_id || card.account_id,
          payment_group_id: groupId,
          issue_type: "duplicate_pair",
          source_account_transaction_id: source.id,
          card_transaction_id: card.id,
          amount: Number(source.amount || 0),
          currency: source.currency,
        })
      }
    }
  }

  const paymentGroupIds = new Set(Array.from(byGroup.keys()).filter((id) => !String(id).startsWith("orphan-")))
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id,user_id,metadata,type")
    .eq("type", "credit")

  for (const note of notifications || []) {
    const groupId = note.metadata?.payment_group_id || note.metadata?.payment_id
    if (!groupId) continue
    if (!paymentGroupIds.has(groupId)) {
      issues.push({
        user_id: note.user_id,
        card_id: null,
        payment_group_id: groupId,
        issue_type: "orphan_notification",
        source_account_transaction_id: null,
        card_transaction_id: null,
        amount: null,
        currency: null,
      })
    }
  }

  const report = issues.map((issue) => ({
    user_id: maskId(issue.user_id),
    card_id: maskId(issue.card_id),
    payment_group_id: issue.payment_group_id,
    issue_type: issue.issue_type,
    source_account_transaction_id: issue.source_account_transaction_id,
    card_transaction_id: issue.card_transaction_id,
    amount: issue.amount,
    currency: issue.currency,
    recommended_fix: recommendedFix(issue.issue_type),
    risk_level: getIssueRisk(issue.issue_type),
  }))

  console.log(`\n[card-payment-integrity] mode=${args.apply ? "apply" : "dry-run"} user=${targetUserId || "all"} email=${args.email || "-"} card=${args.card || "all"}`)
  console.log(`[card-payment-integrity] groups=${byGroup.size} issues=${report.length}`)

  if (report.length === 0) {
    console.log("Sin inconsistencias detectadas en este alcance.")
    return
  }

  console.table(report)

  if (args.apply) {
    console.log("\nModo apply: no se aplicaron cambios automáticos destructivos.")
    console.log("Genera plan de reparación por issue_type y ejecuta con aprobación explícita.")
  }
}

main().catch((error) => {
  console.error("Error en auditoría de integridad:", error?.message || error)
  process.exit(1)
})
