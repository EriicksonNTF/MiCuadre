-- Subscriptions module

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false;

INSERT INTO public.categories (user_id, name, icon, color, type, is_default, is_subscription)
SELECT NULL, 'Suscripciones', 'repeat', '#f59e0b', 'expense', true, true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories
  WHERE is_default = true
    AND LOWER(name) IN ('suscripciones', 'subscriptions')
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  provider_key TEXT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('DOP', 'USD')),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  billing_day INTEGER NOT NULL CHECK (billing_day >= 1 AND billing_day <= 31),
  next_payment_date DATE NOT NULL,
  last_charged_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date ON public.subscriptions(user_id, next_payment_date);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_select_own'
  ) THEN
    CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_insert_own'
  ) THEN
    CREATE POLICY "subscriptions_insert_own" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_update_own'
  ) THEN
    CREATE POLICY "subscriptions_update_own" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_delete_own'
  ) THEN
    CREATE POLICY "subscriptions_delete_own" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('transaction', 'goal', 'credit', 'system', 'transfer', 'subscription'));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS subscription_id UUID;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_subscription_fk;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_subscription_fk
  FOREIGN KEY (subscription_id)
  REFERENCES public.subscriptions(id)
  ON DELETE SET NULL;
