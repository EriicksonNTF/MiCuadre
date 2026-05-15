-- Adds retry/process tracking fields for subscription auto charges.
-- Safe to run multiple times.

alter table if exists public.subscriptions
  add column if not exists last_processed_at date;

alter table if exists public.subscriptions
  add column if not exists retry_count integer not null default 0;

create index if not exists subscriptions_user_status_next_payment_idx
  on public.subscriptions (user_id, status, next_payment_date);
