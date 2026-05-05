-- Commission support, account ordering and transaction links

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_transactions_parent_transaction_id
  ON public.transactions(parent_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin
  ON public.transactions USING gin (metadata);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

COMMIT;
