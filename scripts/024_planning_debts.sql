-- Phase 3: Planning debts and payments module
-- Safe additive migration: does not remove existing tables.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  debt_type text not null default 'loan',
  original_amount numeric(14,2) not null check (original_amount > 0),
  current_balance numeric(14,2) not null check (current_balance >= 0),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  linked_account_id uuid null references public.accounts(id) on delete set null,
  fixed_payment_amount numeric(14,2) null check (fixed_payment_amount >= 0),
  payment_frequency text not null default 'monthly',
  payment_day integer null check (payment_day between 1 and 31),
  start_date date null,
  interest_rate numeric null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  source_account_id uuid null references public.accounts(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  previous_debt_balance numeric(14,2) null,
  new_debt_balance numeric(14,2) null,
  transaction_id uuid null references public.transactions(id) on delete set null,
  payment_date timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists debts_user_active_idx on public.debts(user_id, is_active);
create index if not exists debt_payments_user_id_idx on public.debt_payments(user_id);
create index if not exists debt_payments_debt_id_idx on public.debt_payments(debt_id);

alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'debts' and policyname = 'debts_select_own'
  ) then
    create policy debts_select_own on public.debts
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'debts' and policyname = 'debts_insert_own'
  ) then
    create policy debts_insert_own on public.debts
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'debts' and policyname = 'debts_update_own'
  ) then
    create policy debts_update_own on public.debts
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'debts' and policyname = 'debts_delete_own'
  ) then
    create policy debts_delete_own on public.debts
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'debt_payments' and policyname = 'debt_payments_select_own'
  ) then
    create policy debt_payments_select_own on public.debt_payments
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'debt_payments' and policyname = 'debt_payments_insert_own'
  ) then
    create policy debt_payments_insert_own on public.debt_payments
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;
