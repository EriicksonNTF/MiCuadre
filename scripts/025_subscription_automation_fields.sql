-- Phase: planning subscriptions automation hardening
-- Safe additive migration

alter table if exists public.subscriptions
  add column if not exists linked_account_id uuid null,
  add column if not exists linked_credit_card_id uuid null,
  add column if not exists auto_record_enabled boolean not null default false,
  add column if not exists pre_alert_enabled boolean not null default true,
  add column if not exists last_alert_period text null,
  add column if not exists last_processed_period text null;

create index if not exists subscriptions_user_status_auto_idx
  on public.subscriptions (user_id, status, auto_record_enabled, next_payment_date);
