-- =====================================================
-- 045_backfill_credit_debt.sql
-- Fixes multi-currency debt corruption on credit cards.
--
-- Part 1: Backfill current_debt_dop / current_debt_usd
--   Recalculates from the transactions table per currency,
--   fixing historical corruption caused by syncAccountBalance
--   calling ledger_calc_balance which summed DOP+USD as 1:1.
--
-- Part 2: Fix dual-write in pay_credit_card_safe
--   Removes direct INSERTS into ledger_entries (which
--   reference a nonexistent column `transaction_id` since
--   031_ledger_model.sql named it `reference_id`).
--   Ledger is correctly handled by LedgerService JS code.
-- =====================================================

-- ══════════════════════════════════════════════════════
-- Part 1: Backfill credit card debt from transactions
-- ══════════════════════════════════════════════════════
with debt_calc as (
  select
    t.account_id,
    greatest(
      coalesce(sum(case when t.type = 'expense' and t.currency = 'DOP' then t.amount else 0 end), 0)
      - coalesce(sum(case when t.type = 'income' and t.currency = 'DOP' then t.amount else 0 end), 0),
    0) as debt_dop,
    greatest(
      coalesce(sum(case when t.type = 'expense' and t.currency = 'USD' then t.amount else 0 end), 0)
      - coalesce(sum(case when t.type = 'income' and t.currency = 'USD' then t.amount else 0 end), 0),
    0) as debt_usd
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where a.type = 'credit'
    and t.deleted_at is null
  group by t.account_id
)
update public.accounts a
set
  current_debt_dop = dc.debt_dop,
  current_debt_usd = dc.debt_usd,
  current_debt = dc.debt_dop
from debt_calc dc
where a.id = dc.account_id
  and a.type = 'credit';

-- ══════════════════════════════════════════════════════
-- Part 2: Fix pay_credit_card_safe — remove broken
--          references to nonexistent functions/columns.
--   - record_ledger_entry() does not exist
--   - payment_group_id column does not exist on transactions
--   - reconcile_account_balance() has the same currency bug
--   Ledger is correctly handled by LedgerService JS code.
-- ══════════════════════════════════════════════════════
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
  v_new_debt_dop numeric;
  v_new_debt_usd numeric;
  v_paid_statement numeric;
  v_new_available_credit numeric;
  v_source_new_balance numeric;
  v_payment_group_id uuid;
  v_card_tx_id uuid;
  v_source_tx_id uuid;
  v_commission_category_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'No autenticado');
  end if;

  -- Fetch credit account
  select * into v_credit
  from public.accounts
  where id = p_credit_account_id and user_id = v_user_id and type = 'credit'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Tarjeta de credito no encontrada');
  end if;

  -- Fetch source account
  select * into v_source
  from public.accounts
  where id = p_source_account_id and user_id = v_user_id and type in ('cash', 'debit')
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Cuenta de origen no encontrada');
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'El monto debe ser mayor a cero');
  end if;

  v_source_currency := coalesce(v_source.currency, 'DOP');
  v_conversion_applies := v_source_currency != p_currency;

  if v_conversion_applies then
    if p_exchange_rate is null or p_exchange_rate <= 0 then
      return jsonb_build_object('ok', false, 'error', 'Tasa de cambio invalida');
    end if;
    v_source_debit_amount := round(p_amount * p_exchange_rate * 100) / 100;
  else
    v_source_debit_amount := p_amount;
  end if;

  v_commission_amount := 0;
  if p_apply_commission then
    v_commission_amount := round(v_source_debit_amount * 0.0020 * 100) / 100;
  end if;
  v_total_source_debit := round((v_source_debit_amount + v_commission_amount) * 100) / 100;

  if v_source.balance < v_total_source_debit then
    return jsonb_build_object('ok', false, 'error', 'Fondos insuficientes en la cuenta origen');
  end if;

  v_payment_group_id := gen_random_uuid();

  -- Calculate new debts per currency
  if p_currency = 'USD' then
    v_new_debt_usd := greatest(0, round((coalesce(v_credit.current_debt_usd, 0) - p_amount) * 100) / 100);
    v_new_debt_dop := coalesce(v_credit.current_debt_dop, 0);
  else
    v_new_debt_dop := greatest(0, round((coalesce(v_credit.current_debt_dop, 0) - p_amount) * 100) / 100);
    v_new_debt_usd := coalesce(v_credit.current_debt_usd, 0);
  end if;

  -- Update credit account (reduce debt in correct currency)
  if p_currency = 'USD' then
    update public.accounts
    set current_debt_usd = v_new_debt_usd,
        paid_statement_amount_usd = greatest(0, round((coalesce(paid_statement_amount_usd, 0) + p_amount) * 100) / 100),
        updated_at = now()
    where id = p_credit_account_id;
  else
    update public.accounts
    set current_debt_dop = v_new_debt_dop,
        current_debt = v_new_debt_dop,
        paid_statement_amount_dop = greatest(0, round((coalesce(paid_statement_amount_dop, 0) + p_amount) * 100) / 100),
        paid_amount = greatest(0, round((coalesce(paid_amount, 0) + p_amount) * 100) / 100),
        updated_at = now()
    where id = p_credit_account_id;
  end if;

  -- Debit source account
  v_source_new_balance := round((v_source.balance - v_total_source_debit) * 100) / 100;
  update public.accounts
  set balance = v_source_new_balance,
      updated_at = now()
  where id = p_source_account_id;

  -- Insert payment record
  insert into public.credit_payments (user_id, credit_account_id, source_account_id, amount, currency, payment_kind, notes)
  values (v_user_id, p_credit_account_id, p_source_account_id, p_amount, p_currency, p_payment_kind, p_notes);

  -- Insert source expense transaction
  insert into public.transactions (user_id, account_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
  values (v_user_id, p_source_account_id, 'expense', v_source_debit_amount, v_source_currency, v_source_debit_amount, 1,
          'Pago de tarjeta de credito', CURRENT_DATE,
          jsonb_build_object('kind', 'credit_card_payment', 'payment_group_id', v_payment_group_id, 'credit_account_id', p_credit_account_id))
  returning id into v_source_tx_id;

  -- Insert card income transaction
  insert into public.transactions (user_id, account_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
  values (v_user_id, p_credit_account_id, 'income', p_amount, p_currency, p_amount, 1,
          'Pago recibido - tarjeta de credito', CURRENT_DATE,
          jsonb_build_object('kind', 'credit_card_payment_reversal', 'payment_group_id', v_payment_group_id, 'source_tx_id', v_source_tx_id))
  returning id into v_card_tx_id;

  -- Commission
  if v_commission_amount > 0 then
    select id into v_commission_category_id
    from public.categories
    where user_id = v_user_id and name = 'Comisiones' limit 1;

    if v_commission_category_id is null then
      insert into public.categories (user_id, name, type, icon)
      values (v_user_id, 'Comisiones', 'expense', 'percent')
      returning id into v_commission_category_id;
    end if;

    insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, metadata)
    values (v_user_id, p_source_account_id, v_commission_category_id, 'expense', v_commission_amount, v_source_currency, v_commission_amount, 1,
            'Comision pago tarjeta (0.20%)', CURRENT_DATE,
            jsonb_build_object('kind', 'commission', 'rate', 0.0020, 'payment_group_id', v_payment_group_id));
  end if;

  -- Note: Ledger entries are handled by LedgerService in JS (recordCreditPayment).
  -- No direct ledger writes here — avoids broken calls to record_ledger_entry()
  -- and currency-blind reconcile_account_balance().

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_group_id,
    'amount', p_amount,
    'source_debit_amount', v_source_debit_amount,
    'commission_amount', v_commission_amount,
    'total_source_debit', v_total_source_debit,
    'source_new_balance', v_source_new_balance,
    'new_debt', case when p_currency = 'USD' then v_new_debt_usd else v_new_debt_dop end,
    'source_tx_id', v_source_tx_id,
    'card_tx_id', v_card_tx_id
  );
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$func$;
