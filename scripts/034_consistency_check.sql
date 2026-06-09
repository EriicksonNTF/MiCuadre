-- Verificación de consistencia: stored_balance vs ledger_balance
-- Ejecutar periódicamente durante la migración al ledger
-- Cuando todas las cuentas sean consistentes (✓), se puede eliminar balance/current_debt

SELECT
  a.id,
  a.name,
  a.type,
  a.currency,
  CASE
    WHEN a.type = 'credit' THEN COALESCE(a.current_debt_dop, 0) + COALESCE(a.current_debt_usd, 0)
    ELSE COALESCE(a.balance, 0)
  END AS stored_balance,
  COALESCE(ledger_calc_balance(a.id), 0) AS ledger_balance,
  CASE
    WHEN a.type = 'credit' THEN COALESCE(a.current_debt_dop, 0) + COALESCE(a.current_debt_usd, 0)
    ELSE COALESCE(a.balance, 0)
  END - COALESCE(ledger_calc_balance(a.id), 0) AS discrepancy,
  CASE
    WHEN (CASE
      WHEN a.type = 'credit' THEN COALESCE(a.current_debt_dop, 0) + COALESCE(a.current_debt_usd, 0)
      ELSE COALESCE(a.balance, 0)
    END) = COALESCE(ledger_calc_balance(a.id), 0) THEN '✓'
    ELSE '✗'
  END AS consistent
FROM accounts a
WHERE a.user_id IS NOT NULL
  AND a.is_active = true
ORDER BY 8 ASC, 7 DESC NULLS LAST;
