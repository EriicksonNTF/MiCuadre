-- Migration to backfill existing internal transfers metadata on transactions.
-- Match transactions to own accounts transfers by source/destination account, amount, currency and creation time (within a 60-second window).

BEGIN;

-- 1. Update expense transactions (from_account_id)
WITH matched_transfers AS (
  SELECT 
    t.id AS transfer_id,
    t.from_account_id,
    t.to_account_id,
    t.amount,
    t.currency,
    t.created_at
  FROM public.transfers t
  WHERE t.to_account_id IS NOT NULL
)
UPDATE public.transactions tx
SET metadata = COALESCE(tx.metadata, '{}'::jsonb) || jsonb_build_object(
  'kind', 'transfer',
  'transfer_id', mt.transfer_id,
  'transfer_type', 'internal'
)
FROM matched_transfers mt
WHERE tx.account_id = mt.from_account_id
  AND tx.amount = mt.amount
  AND tx.currency = mt.currency
  AND tx.type = 'expense'
  AND ABS(EXTRACT(EPOCH FROM (tx.created_at - mt.created_at))) < 60;

-- 2. Update income transactions (to_account_id)
WITH matched_transfers AS (
  SELECT 
    t.id AS transfer_id,
    t.from_account_id,
    t.to_account_id,
    t.amount,
    t.currency,
    t.created_at
  FROM public.transfers t
  WHERE t.to_account_id IS NOT NULL
)
UPDATE public.transactions tx
SET metadata = COALESCE(tx.metadata, '{}'::jsonb) || jsonb_build_object(
  'kind', 'transfer',
  'transfer_id', mt.transfer_id,
  'transfer_type', 'internal'
)
FROM matched_transfers mt
WHERE tx.account_id = mt.to_account_id
  AND tx.amount = mt.amount
  AND tx.currency = mt.currency
  AND tx.type = 'income'
  AND ABS(EXTRACT(EPOCH FROM (tx.created_at - mt.created_at))) < 60;

COMMIT;
