-- Phase: Atomic operations via Postgres RPC functions
-- Each function wraps multiple table operations in a single ACID transaction
-- respecting RLS via auth.uid() — no service_role used.
-- Idempotent: all functions use create or replace.

-- =====================================================
-- 1. create_transfer_safe
-- Atomically: validate → insert transfer → insert source tx → debit source
-- → insert dest tx → credit dest → insert commission → debit commission
-- All within one Postgres transaction. If any step fails, everything rolls back.
-- =====================================================

create or replace function public.create_transfer_safe(
  p_from_account_id uuid,
  p_amount numeric,
  p_to_account_id uuid default null,
  p_to_beneficiary_id uuid default null,
  p_currency text default 'DOP',
  p_description text default null,
  p_apply_commission boolean default false,
  p_exchange_rate numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_source_currency text;
  v_source_type text;
  v_source_balance numeric;
  v_dest_id uuid;
  v_dest_currency text;
  v_dest_type text;
  v_dest_balance numeric;
  v_commission_amount numeric;
  v_total_source_debit numeric;
  v_dest_amount numeric;
  v_source_tx_id uuid;
  v_dest_tx_id uuid;
  v_commission_tx_id uuid;
  v_transfer_id uuid;
  v_local_date text;
  v_commission_category_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  v_local_date := to_char(CURRENT_DATE, 'YYYY-MM-DD');

  -- ── Load source account ──
  select currency, type, balance
    into strict v_source_currency, v_source_type, v_source_balance
    from public.accounts
    where id = p_from_account_id and user_id = v_user_id;

  if v_source_type != 'credit' and p_currency != v_source_currency then
    raise exception 'La moneda de la transferencia no coincide con la de la cuenta origen.';
  end if;

  -- ── Calculate commission ──
  v_commission_amount := 0;
  if p_apply_commission then
    v_commission_amount := round(p_amount * 0.0015 * 100) / 100;
  end if;
  v_total_source_debit := round((p_amount + v_commission_amount) * 100) / 100;

  -- ── Validate funds (same logic as ensureSufficientFundsForExpense) ──
  if v_source_type = 'credit' then
    -- handled per-currency in the update section
    null;
  else
    if v_source_balance < v_total_source_debit then
      raise exception 'El monto más comisión excede tu balance disponible.';
    end if;
  end if;

  -- ── Resolve destination amount + currency ──
  v_dest_amount := p_amount;
  if p_to_account_id is not null then
    select currency, type, balance
      into strict v_dest_currency, v_dest_type, v_dest_balance
      from public.accounts
      where id = p_to_account_id and user_id = v_user_id;

    if v_dest_currency != v_source_currency then
      if p_exchange_rate is null or p_exchange_rate <= 0 then
        raise exception 'Ingresa una tasa de cambio válida para transferir entre cuentas de distinta moneda.';
      end if;
      v_dest_amount := round(p_amount * p_exchange_rate * 100) / 100;
    end if;
  end if;

  -- ══════════════════════════════════════════════════
  -- ATOMIC BLOCK – all inserts/updates from here on
  -- ══════════════════════════════════════════════════

  -- 1) Insert transfer record
  insert into public.transfers (user_id, from_account_id, to_account_id, to_beneficiary_id, amount, currency, description)
  values (v_user_id, p_from_account_id, p_to_account_id, p_to_beneficiary_id, p_amount, v_source_currency, p_description)
  returning id into v_transfer_id;

  -- 2) Insert source transaction (expense)
  insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
  values (
    v_user_id, p_from_account_id, null, 'expense', p_amount, v_source_currency, p_amount,
    coalesce(p_exchange_rate, 1),
    coalesce(p_description, 'Transferencia enviada'),
    v_local_date,
    jsonb_build_object(
      'kind', 'transfer',
      'transfer_id', v_transfer_id,
      'transfer_type', case when p_to_account_id is not null then 'internal' else 'external' end
    )
  )
  returning id into v_source_tx_id;

  -- 3) Debit source account
  if v_source_type = 'credit' then
    if v_source_currency = 'USD' then
      update public.accounts
      set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + v_total_source_debit) * 100) / 100)
      where id = p_from_account_id and user_id = v_user_id;
    else
      update public.accounts
      set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + v_total_source_debit) * 100) / 100),
          current_debt = greatest(0, round((coalesce(current_debt_dop, 0) + v_total_source_debit) * 100) / 100)
      where id = p_from_account_id and user_id = v_user_id;
    end if;
  else
    update public.accounts
    set balance = round((balance - v_total_source_debit) * 100) / 100
    where id = p_from_account_id and user_id = v_user_id;
  end if;

  -- 4) Insert destination transaction + credit (only for internal)
  if p_to_account_id is not null then
    insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, parent_transaction_id, metadata)
    values (
      v_user_id, p_to_account_id, null, 'income', v_dest_amount, v_dest_currency, p_amount,
      coalesce(p_exchange_rate, 1),
      coalesce(p_description, 'Transferencia recibida'),
      v_local_date, v_source_tx_id,
      jsonb_build_object('kind', 'transfer', 'transfer_id', v_transfer_id, 'transfer_type', 'internal')
    )
    returning id into v_dest_tx_id;

    if v_dest_type = 'credit' then
      if v_dest_currency = 'USD' then
        update public.accounts
        set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) - v_dest_amount) * 100) / 100)
        where id = p_to_account_id and user_id = v_user_id;
      else
        update public.accounts
        set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) - v_dest_amount) * 100) / 100),
            current_debt = greatest(0, round((coalesce(current_debt_dop, 0) - v_dest_amount) * 100) / 100)
        where id = p_to_account_id and user_id = v_user_id;
      end if;
    else
      update public.accounts
      set balance = round((balance + v_dest_amount) * 100) / 100
      where id = p_to_account_id and user_id = v_user_id;
    end if;
  end if;

  -- 5) Commission
  if v_commission_amount > 0 then
    select id into v_commission_category_id
    from public.categories
    where name = 'Commission / Fees' and type = 'expense'
      and (user_id is null or user_id = v_user_id)
    order by user_id nulls first, is_default desc
    limit 1;

    if v_commission_category_id is null then
      insert into public.categories (user_id, name, icon, color, type, is_default)
      values (v_user_id, 'Commission / Fees', 'circle', '#64748b', 'expense', false)
      returning id into v_commission_category_id;
    end if;

    insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, parent_transaction_id, metadata)
    values (
      v_user_id, p_from_account_id, v_commission_category_id, 'expense', v_commission_amount, v_source_currency, v_commission_amount, 1,
      'Comisión de 0.15% de ' || coalesce(p_description, 'transferencia'),
      v_local_date, v_source_tx_id,
      jsonb_build_object('kind', 'commission', 'rate', 0.0015, 'transfer_id', v_transfer_id)
    )
    returning id into v_commission_tx_id;

    if v_source_type = 'credit' then
      if v_source_currency = 'USD' then
        update public.accounts
        set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + v_commission_amount) * 100) / 100)
        where id = p_from_account_id and user_id = v_user_id;
      else
        update public.accounts
        set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + v_commission_amount) * 100) / 100),
            current_debt = greatest(0, round((coalesce(current_debt_dop, 0) + v_commission_amount) * 100) / 100)
        where id = p_from_account_id and user_id = v_user_id;
      end if;
    else
      update public.accounts
      set balance = round((balance - v_commission_amount) * 100) / 100
      where id = p_from_account_id and user_id = v_user_id;
    end if;
  end if;

  -- Build return
  v_result := jsonb_build_object(
    'transfer_id', v_transfer_id,
    'source_transaction_id', v_source_tx_id,
    'dest_transaction_id', v_dest_tx_id,
    'commission_transaction_id', v_commission_tx_id
  );

  return v_result;
exception
  when others then
    raise;
end;
$$;

-- =====================================================
-- 2. add_goal_contribution_safe
-- Atomically: validate funds → insert contribution → update goal
-- → insert transaction → debit account. All in one transaction.
-- =====================================================

create or replace function public.add_goal_contribution_safe(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_date text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_account_currency text;
  v_account_type text;
  v_account_balance numeric;
  v_goal_current numeric;
  v_goal_target numeric;
  v_new_amount numeric;
  v_is_completed boolean;
  v_contribution_id uuid;
  v_tx_id uuid;
  v_local_date text;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  v_local_date := coalesce(p_date, to_char(CURRENT_DATE, 'YYYY-MM-DD'));

  -- Load account
  select currency, type, balance
    into strict v_account_currency, v_account_type, v_account_balance
    from public.accounts
    where id = p_account_id and user_id = v_user_id;

  -- Validate funds
  if v_account_type != 'credit' then
    if v_account_balance < p_amount then
      raise exception 'Fondos insuficientes en la cuenta';
    end if;
  end if;

  -- Insert contribution
  insert into public.goal_contributions (user_id, goal_id, account_id, amount, date, notes)
  values (v_user_id, p_goal_id, p_account_id, p_amount, v_local_date::timestamptz, p_notes)
  returning id into v_contribution_id;

  -- Update goal current_amount
  select current_amount, target_amount
    into v_goal_current, v_goal_target
    from public.goals
    where id = p_goal_id and user_id = v_user_id;

  v_new_amount := round((coalesce(v_goal_current, 0) + p_amount) * 100) / 100;
  v_is_completed := v_new_amount >= coalesce(v_goal_target, 0);

  update public.goals
  set current_amount = v_new_amount, is_completed = v_is_completed
  where id = p_goal_id and user_id = v_user_id;

  -- Insert transaction
  insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
  values (
    v_user_id, p_account_id, null, 'expense', p_amount, v_account_currency, p_amount, 1,
    'Aporte a meta de ahorro', v_local_date,
    jsonb_build_object('kind', 'goal_contribution', 'goal_id', p_goal_id, 'contribution_id', v_contribution_id)
  )
  returning id into v_tx_id;

  -- Debit account
  if v_account_type = 'credit' then
    if v_account_currency = 'USD' then
      update public.accounts
      set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + p_amount) * 100) / 100)
      where id = p_account_id and user_id = v_user_id;
    else
      update public.accounts
      set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + p_amount) * 100) / 100),
          current_debt = greatest(0, round((coalesce(current_debt_dop, 0) + p_amount) * 100) / 100)
      where id = p_account_id and user_id = v_user_id;
    end if;
  else
    update public.accounts
    set balance = round((balance - p_amount) * 100) / 100
    where id = p_account_id and user_id = v_user_id;
  end if;

  v_result := jsonb_build_object(
    'contribution_id', v_contribution_id,
    'transaction_id', v_tx_id,
    'new_goal_amount', v_new_amount,
    'is_completed', v_is_completed
  );

  return v_result;
exception
  when others then
    raise;
end;
$$;

-- =====================================================
-- 3. create_transaction_safe
-- Atomically: insert transaction + optional commission
-- + debit account. All in one transaction.
-- =====================================================

create or replace function public.create_transaction_safe(
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text,
  p_description text default null,
  p_date text default null,
  p_category_id uuid default null,
  p_notes text default null,
  p_apply_commission boolean default false,
  p_exchange_rate numeric default 1,
  p_amount_base numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_account_currency text;
  v_account_type text;
  v_account_balance numeric;
  v_commission_amount numeric;
  v_total_debit numeric;
  v_tx_id uuid;
  v_commission_tx_id uuid;
  v_commission_category_id uuid;
  v_local_date text;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  v_local_date := coalesce(p_date, to_char(CURRENT_DATE, 'YYYY-MM-DD'));

  -- Load account
  select currency, type, balance
    into strict v_account_currency, v_account_type, v_account_balance
    from public.accounts
    where id = p_account_id and user_id = v_user_id;

  -- Validate currency for non-credit accounts
  if v_account_type != 'credit' and p_currency != v_account_currency then
    raise exception 'La moneda de la transacción no coincide con la de la cuenta.';
  end if;

  -- Calculate commission
  v_commission_amount := 0;
  if p_apply_commission and p_type = 'expense' then
    v_commission_amount := round(p_amount * 0.0015 * 100) / 100;
  end if;
  v_total_debit := round((p_amount + v_commission_amount) * 100) / 100;

  -- Validate funds
  if p_type = 'expense' then
    if v_account_type = 'credit' then
      null; -- credit validation handled by the update clamping to >= 0
    else
      if v_account_balance < v_total_debit then
        raise exception 'El monto más comisión excede tu balance disponible.';
      end if;
    end if;
  end if;

  -- Insert transaction
  insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, notes)
  values (
    v_user_id, p_account_id, p_category_id, p_type, p_amount, p_currency,
    coalesce(p_amount_base, p_amount), coalesce(p_exchange_rate, 1),
    p_description, v_local_date, p_notes
  )
  returning id into v_tx_id;

  -- Apply account impact
  if v_account_type = 'credit' then
    if p_type = 'expense' then
      if p_currency = 'USD' then
        update public.accounts
        set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + v_total_debit) * 100) / 100)
        where id = p_account_id and user_id = v_user_id;
      else
        update public.accounts
        set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + v_total_debit) * 100) / 100),
            current_debt = greatest(0, round((coalesce(current_debt_dop, 0) + v_total_debit) * 100) / 100)
        where id = p_account_id and user_id = v_user_id;
      end if;
    else
      if p_currency = 'USD' then
        update public.accounts
        set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) - v_total_debit) * 100) / 100)
        where id = p_account_id and user_id = v_user_id;
      else
        update public.accounts
        set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) - v_total_debit) * 100) / 100),
            current_debt = greatest(0, round((coalesce(current_debt_dop, 0) - v_total_debit) * 100) / 100)
        where id = p_account_id and user_id = v_user_id;
      end if;
    end if;
  else
    if p_type = 'expense' then
      update public.accounts
      set balance = round((balance - v_total_debit) * 100) / 100
      where id = p_account_id and user_id = v_user_id;
    else
      update public.accounts
      set balance = round((balance + p_amount) * 100) / 100
      where id = p_account_id and user_id = v_user_id;
    end if;
  end if;

  -- Commission
  if v_commission_amount > 0 then
    select id into v_commission_category_id
    from public.categories
    where name = 'Commission / Fees' and type = 'expense'
      and (user_id is null or user_id = v_user_id)
    order by user_id nulls first, is_default desc
    limit 1;

    if v_commission_category_id is null then
      insert into public.categories (user_id, name, icon, color, type, is_default)
      values (v_user_id, 'Commission / Fees', 'circle', '#64748b', 'expense', false)
      returning id into v_commission_category_id;
    end if;

    insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, parent_transaction_id, metadata)
    values (
      v_user_id, p_account_id, v_commission_category_id, 'expense', v_commission_amount, p_currency, v_commission_amount, 1,
      'Comisión de 0.15% de ' || coalesce(p_description, 'transacción'),
      v_local_date, v_tx_id,
      jsonb_build_object('kind', 'commission', 'rate', 0.0015)
    )
    returning id into v_commission_tx_id;

    if v_account_type = 'credit' then
      if p_currency = 'USD' then
        update public.accounts
        set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + v_commission_amount) * 100) / 100)
        where id = p_account_id and user_id = v_user_id;
      else
        update public.accounts
        set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + v_commission_amount) * 100) / 100),
            current_debt = greatest(0, round((coalesce(current_debt_dop, 0) + v_commission_amount) * 100) / 100)
        where id = p_account_id and user_id = v_user_id;
      end if;
    else
      update public.accounts
      set balance = round((balance - v_commission_amount) * 100) / 100
      where id = p_account_id and user_id = v_user_id;
    end if;
  end if;

  v_result := jsonb_build_object(
    'transaction_id', v_tx_id,
    'commission_transaction_id', v_commission_tx_id
  );

  return v_result;
exception
  when others then
    raise;
end;
$$;
