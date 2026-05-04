-- MiCuadre Database Schema
-- Personal Finance App with Multi-Currency Support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  preferred_currency TEXT DEFAULT 'DOP' CHECK (preferred_currency IN ('DOP', 'USD')),
  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CATEGORIES (default + custom per user)
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'circle',
  color TEXT DEFAULT '#6366f1',
  type TEXT DEFAULT 'expense' CHECK (type IN ('expense', 'income', 'both')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ACCOUNTS (cash, debit, credit)
-- ============================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'debit', 'credit')),
  currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  balance DECIMAL(15, 2) DEFAULT 0,
  -- Credit card specific fields
  credit_limit DECIMAL(15, 2),
  current_debt DECIMAL(15, 2) DEFAULT 0,
  closing_date INTEGER CHECK (closing_date >= 1 AND closing_date <= 31),
  due_date INTEGER CHECK (due_date >= 1 AND due_date <= 31),
  minimum_payment DECIMAL(15, 2),
  -- Styling
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'wallet',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  amount_base DECIMAL(15, 2), -- Converted to user's base currency
  exchange_rate DECIMAL(10, 4) DEFAULT 1,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. BENEFICIARIES (for transfers)
-- ============================================
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_reference TEXT, -- Bank account or identifier
  bank_name TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. TRANSFERS (between accounts or to beneficiaries)
-- ============================================
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_beneficiary_id UUID REFERENCES public.beneficiaries(id) ON DELETE SET NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  description TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Either to_account_id or to_beneficiary_id must be set
  CONSTRAINT transfer_destination CHECK (
    (to_account_id IS NOT NULL AND to_beneficiary_id IS NULL) OR
    (to_account_id IS NULL AND to_beneficiary_id IS NOT NULL)
  )
);

-- ============================================
-- 7. GOALS (savings goals)
-- ============================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(15, 2) DEFAULT 0 CHECK (current_amount >= 0),
  currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  target_date DATE,
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'target',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. GOAL CONTRIBUTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('transaction', 'goal', 'credit', 'system', 'transfer')),
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. RECEIPT SCANS (AI-generated drafts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.receipt_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  raw_text TEXT,
  parsed_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'confirmed', 'rejected')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. CREDIT CARD PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id ON public.goal_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON public.beneficiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_user_id ON public.receipt_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_user_id ON public.credit_payments(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- CATEGORIES policies (include default categories for all users)
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (
  user_id = auth.uid() OR is_default = true
);
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE USING (auth.uid() = user_id AND is_default = false);
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- ACCOUNTS policies
CREATE POLICY "accounts_select_own" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- TRANSACTIONS policies
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- BENEFICIARIES policies
CREATE POLICY "beneficiaries_select_own" ON public.beneficiaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "beneficiaries_insert_own" ON public.beneficiaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "beneficiaries_update_own" ON public.beneficiaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "beneficiaries_delete_own" ON public.beneficiaries FOR DELETE USING (auth.uid() = user_id);

-- TRANSFERS policies
CREATE POLICY "transfers_select_own" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transfers_insert_own" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transfers_update_own" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transfers_delete_own" ON public.transfers FOR DELETE USING (auth.uid() = user_id);

-- GOALS policies
CREATE POLICY "goals_select_own" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert_own" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update_own" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete_own" ON public.goals FOR DELETE USING (auth.uid() = user_id);

-- GOAL_CONTRIBUTIONS policies
CREATE POLICY "goal_contributions_select_own" ON public.goal_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goal_contributions_insert_own" ON public.goal_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goal_contributions_update_own" ON public.goal_contributions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goal_contributions_delete_own" ON public.goal_contributions FOR DELETE USING (auth.uid() = user_id);

-- NOTIFICATIONS policies
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- RECEIPT_SCANS policies
CREATE POLICY "receipt_scans_select_own" ON public.receipt_scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "receipt_scans_insert_own" ON public.receipt_scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "receipt_scans_update_own" ON public.receipt_scans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "receipt_scans_delete_own" ON public.receipt_scans FOR DELETE USING (auth.uid() = user_id);

-- CREDIT_PAYMENTS policies
CREATE POLICY "credit_payments_select_own" ON public.credit_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credit_payments_insert_own" ON public.credit_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_payments_update_own" ON public.credit_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "credit_payments_delete_own" ON public.credit_payments FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
