-- 031_ledger_model.sql
-- Phase 2: Ledger doble entrada + fee_rules configurables
-- Cada escritura financiera genera 2+ filas en ledger_entries (inmutable).
-- balance/current_debt en accounts siguen como caché materializada.

-- =====================================================
-- 1. ledger_entries — fuente de verdad inmutable
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debit_account_id UUID NOT NULL,
  credit_account_id UUID NOT NULL,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('DOP', 'USD')),
  description TEXT,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'transfer', 'expense', 'income', 'credit_payment',
    'goal_contribution', 'commission', 'interest', 'loan_payment'
  )),
  reference_id UUID,
  reference_table TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sin FK directo a accounts: debit_account_id y credit_account_id
  -- pueden ser cuentas reales O virtuales (GLOBAL_INCOME/GLOBAL_EXPENSE).
  -- La integridad referencial se valida en la aplicación.
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON public.ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_debit_account ON public.ledger_entries(debit_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_credit_account ON public.ledger_entries(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON public.ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON public.ledger_entries(reference_id, reference_table);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON public.ledger_entries(entry_type);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_select_own" ON public.ledger_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ledger_insert_own" ON public.ledger_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ledger_entries NEVER allows UPDATE or DELETE (inmutable)
-- Si se requiere corrección, se inserta una entrada de reversión.

-- =====================================================
-- 2. fee_rules — comisiones configurables por plan
-- =====================================================
CREATE TABLE IF NOT EXISTS public.fee_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free', 'pro', 'plus')),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'fixed')),
  value DECIMAL(10,4) NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('transfer', 'expense', 'late_payment', 'maintenance')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_tier, rule_name)
);

ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_rules_select_all" ON public.fee_rules
  FOR SELECT USING (true);

CREATE POLICY "fee_rules_insert_admin" ON public.fee_rules
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM public.profiles WHERE plan_tier = 'plus'
  ));

CREATE POLICY "fee_rules_update_admin" ON public.fee_rules
  FOR UPDATE USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE plan_tier = 'plus'
  ));

-- Seed: reglas de comisión por plan
INSERT INTO public.fee_rules (plan_tier, rule_name, rule_type, value, applies_to)
VALUES
  ('free', 'commission_rate', 'percentage', 0.0030, 'transfer'),
  ('free', 'commission_rate', 'percentage', 0.0030, 'expense'),
  ('pro',  'commission_rate', 'percentage', 0.0020, 'transfer'),
  ('pro',  'commission_rate', 'percentage', 0.0020, 'expense'),
  ('plus', 'commission_rate', 'percentage', 0.0000, 'transfer'),
  ('plus', 'commission_rate', 'percentage', 0.0000, 'expense'),
  ('free', 'late_fee_rate',    'percentage', 0.1200, 'late_payment'),
  ('pro',  'late_fee_rate',    'percentage', 0.1000, 'late_payment'),
  ('plus', 'late_fee_rate',    'percentage', 0.0800, 'late_payment')
ON CONFLICT (plan_tier, rule_name) DO NOTHING;

-- =====================================================
-- 3. Función ledger: calcular balance desde entradas
-- =====================================================
CREATE OR REPLACE FUNCTION public.ledger_calc_balance(p_account_id UUID)
RETURNS DECIMAL(18,2)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL(18,2);
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN le.credit_account_id = p_account_id THEN le.amount
      WHEN le.debit_account_id  = p_account_id THEN -le.amount
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM public.ledger_entries le
  WHERE le.debit_account_id = p_account_id
     OR le.credit_account_id = p_account_id;

  RETURN GREATEST(v_balance, 0);
END;
$$;

-- =====================================================
-- 4. Función ledger: verificar consistencia vs stored
-- =====================================================
CREATE OR REPLACE FUNCTION public.ledger_check_account(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_account_type TEXT;
  v_stored_balance DECIMAL(18,2);
  v_ledger_balance DECIMAL(18,2);
  v_discrepancy DECIMAL(18,2);
BEGIN
  SELECT type,
    CASE
      WHEN type = 'credit' THEN COALESCE(current_debt_dop, current_debt, 0)
      ELSE COALESCE(balance, 0)
    END
  INTO v_account_type, v_stored_balance
  FROM public.accounts
  WHERE id = p_account_id;

  v_ledger_balance := public.ledger_calc_balance(p_account_id);
  v_discrepancy := ROUND((v_stored_balance - v_ledger_balance) * 100) / 100;

  RETURN JSONB_BUILD_OBJECT(
    'account_id', p_account_id,
    'account_type', v_account_type,
    'stored_balance', v_stored_balance,
    'ledger_balance', v_ledger_balance,
    'discrepancy', v_discrepancy,
    'consistent', ABS(v_discrepancy) < 0.01
  );
END;
$$;
