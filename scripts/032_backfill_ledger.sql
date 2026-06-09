-- 032_backfill_ledger.sql (CORREGIDO)
-- Backfill ledger_entries con polaridad correcta:
--   Débito/Cash (activos):  expense → debit=account, income → credit=account
--   Crédito (pasivos):       expense → credit=account (deuda aumenta),
--                             payment → debit=account  (deuda disminuye)
-- Idempotente: DELETE + re-insert.

-- 0. Limpiar entries previas (backfill incorrecto)
DELETE FROM public.ledger_entries;

-- =====================================================
-- 1. TRANSACTIONS
-- =====================================================
-- Débito/Cash: expense=debit, income=credit
INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table, created_at)
SELECT
  t.user_id,
  CASE
    WHEN a.type = 'credit' THEN '00000000-0000-0000-0000-000000000002'::uuid
    WHEN t.type = 'expense' THEN t.account_id
    ELSE '00000000-0000-0000-0000-000000000001'::uuid
  END,
  CASE
    WHEN a.type = 'credit' THEN t.account_id
    WHEN t.type = 'expense' THEN '00000000-0000-0000-0000-000000000002'::uuid
    ELSE t.account_id
  END,
  t.amount,
  COALESCE(t.currency, 'DOP'),
  COALESCE(t.description, CASE WHEN t.type = 'expense' THEN 'Gasto' ELSE 'Ingreso' END),
  CASE
    WHEN t.metadata->>'kind' = 'transfer' THEN 'transfer'
    WHEN t.metadata->>'kind' = 'goal_contribution' THEN 'goal_contribution'
    WHEN t.metadata->>'kind' = 'commission' THEN 'commission'
    WHEN t.metadata->>'kind' = 'credit_payment' THEN 'credit_payment'
    WHEN a.type = 'credit' THEN 'expense'
    ELSE t.type
  END,
  t.id, 'transactions', t.created_at
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id;

-- =====================================================
-- 2. TRANSFERS internas
-- =====================================================
-- from_account → GLOBAL_EXPENSE  (debit desde la cuenta origen)
-- GLOBAL_INCOME → to_account     (credit a la cuenta destino)
-- Para tarjetas como origen: reversa la polaridad

-- Lado débito (origen)
INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table, created_at)
SELECT
  t.user_id,
  CASE WHEN a.type = 'credit' THEN '00000000-0000-0000-0000-000000000002'::uuid ELSE t.from_account_id END,
  CASE WHEN a.type = 'credit' THEN t.from_account_id ELSE '00000000-0000-0000-0000-000000000002'::uuid END,
  t.amount,
  COALESCE(t.currency, 'DOP'),
  COALESCE(t.description, 'Transferencia enviada'),
  'transfer',
  t.id, 'transfers_debit', t.created_at
FROM public.transfers t
JOIN public.accounts a ON a.id = t.from_account_id
WHERE t.to_account_id IS NOT NULL;

-- Lado crédito (destino)
INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table, created_at)
SELECT
  t.user_id,
  CASE WHEN a.type = 'credit' THEN '00000000-0000-0000-0000-000000000002'::uuid ELSE '00000000-0000-0000-0000-000000000001'::uuid END,
  CASE WHEN a.type = 'credit' THEN t.to_account_id ELSE '00000000-0000-0000-0000-000000000001'::uuid END,
  t.amount,
  COALESCE(t.currency, 'DOP'),
  COALESCE(t.description, 'Transferencia recibida'),
  'transfer',
  t.id, 'transfers_credit', t.created_at
FROM public.transfers t
JOIN public.accounts a ON a.id = t.to_account_id
WHERE t.to_account_id IS NOT NULL;

-- =====================================================
-- 3. CREDIT PAYMENTS
-- =====================================================
-- source_account → GLOBAL_EXPENSE (sale de la cuenta origen)
-- credit_account → debit  (reduce la deuda = debit en pasivo)
INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table, created_at)
SELECT
  cp.user_id,
  cp.source_account_id,
  '00000000-0000-0000-0000-000000000002'::uuid,
  cp.amount,
  COALESCE(cp.currency, 'DOP'),
  'Pago a tarjeta de crédito',
  'credit_payment',
  cp.id, 'credit_payments_debit', COALESCE(cp.payment_date, cp.created_at)
FROM public.credit_payments cp;

INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table, created_at)
SELECT
  cp.user_id,
  cp.credit_account_id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  cp.amount,
  COALESCE(cp.currency, 'DOP'),
  'Reducción de deuda por pago',
  'credit_payment',
  cp.id, 'credit_payments_credit', COALESCE(cp.payment_date, cp.created_at)
FROM public.credit_payments cp;

-- =====================================================
-- 4. GOAL CONTRIBUTIONS
-- =====================================================
INSERT INTO public.ledger_entries (user_id, debit_account_id, credit_account_id, amount, currency, description, entry_type, reference_id, reference_table, created_at)
SELECT
  gc.user_id,
  CASE WHEN a.type = 'credit' THEN '00000000-0000-0000-0000-000000000002'::uuid ELSE gc.account_id END,
  CASE WHEN a.type = 'credit' THEN gc.account_id ELSE '00000000-0000-0000-0000-000000000002'::uuid END,
  gc.amount,
  COALESCE(a.currency, 'DOP'),
  COALESCE(gc.notes, 'Aporte a meta de ahorro'),
  'goal_contribution',
  gc.id, 'goal_contributions', COALESCE(gc.date, gc.created_at)
FROM public.goal_contributions gc
JOIN public.accounts a ON a.id = gc.account_id;

-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================
SELECT entry_type, COUNT(*) AS entries
FROM public.ledger_entries
GROUP BY entry_type ORDER BY entry_type;
