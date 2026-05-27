-- Phase 1: Planning budgets module
-- Safe additive migration: does not remove existing goals artifacts.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid null references public.categories(id) on delete set null,
  category_name text not null,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  period text not null default 'monthly' check (period in ('monthly')),
  alert_threshold numeric(5,2) not null default 80 check (alert_threshold >= 1 and alert_threshold <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budgets_user_id_idx on public.budgets(user_id);
create index if not exists budgets_user_active_idx on public.budgets(user_id, is_active);
create index if not exists budgets_category_idx on public.budgets(user_id, category_id);

alter table public.budgets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_select_own'
  ) then
    create policy budgets_select_own on public.budgets
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_insert_own'
  ) then
    create policy budgets_insert_own on public.budgets
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_update_own'
  ) then
    create policy budgets_update_own on public.budgets
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'budgets' and policyname = 'budgets_delete_own'
  ) then
    create policy budgets_delete_own on public.budgets
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

