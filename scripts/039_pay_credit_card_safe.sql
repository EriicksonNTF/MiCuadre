-- =====================================================
-- 039_pay_credit_card_safe.sql
-- Atomic credit card payment RPC.
-- Wraps: validate → calculate conversion → debit source
-- → credit card → insert payment record → insert source tx
-- → insert card tx → insert commission → all ACID.
-- Idempotent: create or replace.
-- =====================================================

create or replace function public.pay_credit_card_safe(
  p_credit_account_id uuid,
  p_source_account_id uuid,
  p_amount numeric,
  p_currency text default 'DOP',
  p_payment_kind text default 'custom',
  p_apply_commission boolean default false,
  p_exchange_rate numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user_id uuid;
  v_credit record;
  v_source record;
  v_source_currency text;
  v_conversion_applies boolean;
  v_exchange_rate numeric;
  v_source_debit_amount numeric;
  v_commission_amount numeric;
  v_total_source_debit numeric;
  v_debt_field text;
  v_limit_field text;
  v_statement_field text;
  v_paid_statement_field text;
  v_current_debt numeric;
  v_current_statement numeric;
  v_current_paid_statement numeric;
  v_new_debt numeric;
  v_statement_remaining numeric;
  v_paid_toward_statement numeric;
  v_new_paid_statement numeric;
  v_card_limit numeric;
  v_new_available_credit numeric;
  v_payment_group_id text;
  v_payment_record_id uuid;
  v_source_tx_id uuid;
  v_card_tx_id uuid;
  v_commission_category_id uuid;
  v_commission_tx_id uuid;
  v_local_date date;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_amount <= 0 then
    raise exception 'Monto de pago invalido';
  end if;

  v_payment_group_id := public.uuid_generate_v4()::text;
  v_local_date := CURRENT_DATE;

  -- Load credit card account
  select * into strict v_credit
  from public.accounts
  where id = p_credit_account_id and user_id = v_user_id and type = 'credit';

  if v_credit is null then
    raise exception 'Tarjeta de credito no encontrada';
  end if;

  -- Load source account
  select * into strict v_source
  from public.accounts
  where id = p_source_account_id and user_id = v_user_id;

  if v_source is null then
    raise exception 'Cuenta origen no encontrada';
  end if;

  v_source_currency := v_source.currency;

  -- Check conversion
  v_conversion_applies := (v_source_currency != p_currency);
  v_exchange_rate := 1;

  if v_conversion_applies then
    if p_exchange_rate is null or p_exchange_rate <= 0 then
      raise exception 'Se requiere tasa de cambio para pagar en moneda diferente a la cuenta origen';
    end if;
    v_exchange_rate := p_exchange_rate;

    if p_currency = 'USD' and v_source_currency = 'DOP' then
      v_source_debit_amount := round(p_amount * v_exchange_rate * 100) / 100;
    else
      v_source_debit_amount := round(p_amount / v_exchange_rate * 100) / 100;
    end if;
  else
    v_source_debit_amount := p_amount;
  end if;

  v_commission_amount := 0;
  if p_apply_commission then
    v_commission_amount := round(v_source_debit_amount * 0.0020 * 100) / 100;
  end if;
  v_total_source_debit := round((v_source_debit_amount + v_commission_amount) * 100) / 100;

  -- Validate source account balance
  if v_source.type != 'credit' then
    if coalesce(v_source.balance, 0) < v_total_source_debit then
      raise exception 'Disponible insuficiente en la cuenta origen para este pago';
    end if;
  end if;

  -- Resolve currency-specific column names
  if p_currency = 'USD' then
    v_debt_field := 'current_debt_usd';
    v_limit_field := 'credit_limit_usd';
    v_statement_field := 'statement_balance_usd';
    v_paid_statement_field := 'paid_statement_amount_usd';
  else
    v_debt_field := 'current_debt_dop';
    v_limit_field := 'credit_limit_dop';
    v_statement_field := 'statement_balance_dop';
    v_paid_statement_field := 'paid_statement_amount_dop';
  end if;

  -- Read current values using dynamic column name
  execute format('select coalesce(%I, 0) from public.accounts where id = $1', v_debt_field)
    into v_current_debt using p_credit_account_id;
  execute format('select coalesce(%I, 0) from public.accounts where id = $1', v_statement_field)
    into v_current_statement using p_credit_account_id;
  execute format('select coalesce(%I, 0) from public.accounts where id = $1', v_paid_statement_field)
    into v_current_paid_statement using p_credit_account_id;
  execute format('select coalesce(%I, 0) from public.accounts where id = $1', v_limit_field)
    into v_card_limit using p_credit_account_id;

  if p_amount > v_current_debt then
    raise exception 'No puedes pagar mas que la deuda actual';
  end if;

  v_new_debt := round(greatest(0, v_current_debt - p_amount) * 100) / 100;
  v_statement_remaining := greatest(0, v_current_statement - v_current_paid_statement);
  v_paid_toward_statement := least(p_amount, v_statement_remaining);
  v_new_paid_statement := round((v_current_paid_statement + v_paid_toward_statement) * 100) / 100;
  v_new_available_credit := round(least(v_card_limit, greatest(0, v_card_limit - v_new_debt)) * 100) / 100;

  -- ══════════════════════════════════════════════════
  -- ATOMIC BLOCK
  -- ══════════════════════════════════════════════════

  -- 1) Update credit card account
  execute format('update public.accounts set %I = $1, %I = $2, available_credit_%s = $3',
    v_debt_field, v_paid_statement_field, lower(p_currency))
  using v_new_debt, v_new_paid_statement, v_new_available_credit
  where id = p_credit_account_id and user_id = v_user_id;

  -- Also update legacy DOP fields if paying in DOP
  if p_currency = 'DOP' then
    update public.accounts
    set current_debt = v_new_debt,
        pending_amount = greatest(0, round((coalesce(statement_balance, 0) - v_new_paid_statement) * 100) / 100),
        paid_amount = v_new_paid_statement
    where id = p_credit_account_id and user_id = v_user_id;
  end if;

  -- 2) Debit source account
  if v_source.type = 'credit' then
    if v_source_currency = 'USD' then
      update public.accounts
      set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + v_total_source_debit) * 100) / 100)
      where id = p_source_account_id;
    else
      update public.accounts
      set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + v_total_source_debit) * 100) / 100),
          current_debt = greatest(0, round((coalesce(current_debt, 0) + v_total_source_debit) * 100) / 100)
      where id = p_source_account_id;
    end if;
  else
    update public.accounts
    set balance = round((balance - v_total_source_debit) * 100) / 100
    where id = p_source_account_id;
  end if;

  -- 3) Insert payment record
  insert into public.credit_payments (user_id, credit_account_id, source_account_id, amount, currency, payment_kind, notes)
  values (v_user_id, p_credit_account_id, p_source_account_id, p_amount, p_currency, p_payment_kind, p_notes)
  returning id into v_payment_record_id;

  -- 4) Insert source transaction (expense)
  insert into public.transactions (user_id, account_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
  values (
    v_user_id, p_source_account_id, 'expense', v_source_debit_amount, v_source_currency,
    p_amount, v_exchange_rate,
    'Pago a tarjeta de credito',
    v_local_date,
    jsonb_build_object(
      'kind', 'credit_payment',
      'payment_group_id', v_payment_group_id,
      'payment_id', v_payment_record_id,
      'credit_account_id', p_credit_account_id,
      'source_account_id', p_source_account_id,
      'payment_kind', p_payment_kind,
      'payment_currency', p_currency,
      'currency', p_currency,
      'original_amount', p_amount,
      'side', 'source_account'
    )
  )
  returning id into v_source_tx_id;

  -- 5) Insert card transaction (income)
  insert into public.transactions (user_id, account_id, type, amount, currency, amount_base, exchange_rate, description, date, parent_transaction_id, metadata)
  values (
    v_user_id, p_credit_account_id, 'income', p_amount, p_currency,
    p_amount, 1,
    'Pago recibido',
    v_local_date, v_source_tx_id,
    jsonb_build_object(
      'kind', 'credit_payment',
      'payment_group_id', v_payment_group_id,
      'payment_id', v_payment_record_id,
      'source_account_id', p_source_account_id,
      'credit_card_id', p_credit_account_id,
      'payment_kind', p_payment_kind,
      'payment_currency', p_currency,
      'currency', p_currency,
      'original_amount', p_amount,
      'side', 'credit_card'
    )
  )
  returning id into v_card_tx_id;

  -- 6) Commission
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

    insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
    values (
      v_user_id, p_source_account_id, v_commission_category_id, 'expense', v_commission_amount, v_source_currency, v_commission_amount, 1,
      'Comision de 0.15% por pago de tarjeta',
      v_local_date,
      jsonb_build_object('kind', 'commission', 'rate', 0.0020, 'payment_group_id', v_payment_group_id)
    )
    returning id into v_commission_tx_id;

    if v_source.type = 'credit' then
      if v_source_currency = 'USD' then
        update public.accounts
        set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + v_commission_amount) * 100) / 100)
        where id = p_source_account_id;
      else
        update public.accounts
        set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + v_commission_amount) * 100) / 100),
            current_debt = greatest(0, round((coalesce(current_debt, 0) + v_commission_amount) * 100) / 100)
        where id = p_source_account_id;
      end if;
    else
      update public.accounts
      set balance = round((balance - v_commission_amount) * 100) / 100
      where id = p_source_account_id;
    end if;
  end if;

  -- 7) Record ledger entry for source debit
  insert into public.ledger_entries (user_id, debit_account_id, transaction_id, amount, currency, description)
  values (v_user_id, p_source_account_id, v_source_tx_id, v_source_debit_amount, v_source_currency, 'Pago de tarjeta');
  insert into public.ledger_entries (user_id, credit_account_id, transaction_id, amount, currency, description)
  values (v_user_id, p_credit_account_id, v_card_tx_id, p_amount, p_currency, 'Pago recibido en tarjeta');

  v_result := jsonb_build_object(
    'payment_id', v_payment_record_id,
    'source_transaction_id', v_source_tx_id,
    'card_transaction_id', v_card_tx_id,
    'commission_transaction_id', v_commission_tx_id,
    'new_debt', v_new_debt
  );

  return v_result;
exception
  when others then
    raise;
end;
$func$;
