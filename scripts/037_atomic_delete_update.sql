-- =====================================================
-- 037_atomic_delete_update.sql
-- Atomic delete and update for transactions.
-- Fully ACID: all operations in a single Postgres transaction.
-- No best-effort writes. If any step fails, everything rolls back.
-- Idempotent: all functions use create or replace.
-- =====================================================

-- ══════════════════════════════════════════════════════
-- Helper: reverse a single transaction's impact on its account
-- ══════════════════════════════════════════════════════
create or replace function public._reverse_tx_impact(
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_acc record;
  v_signed numeric;
begin
  select type, currency, balance, current_debt, current_debt_dop, current_debt_usd
    into strict v_acc
    from public.accounts
    where id = p_account_id;

  if v_acc.type = 'credit' then
    -- Credit accounts: expense increases debt, income decreases debt.
    -- To reverse: expense → decrease debt, income → increase debt.
    if p_currency = 'USD' then
      if p_type = 'expense' then
        update public.accounts
          set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) - p_amount) * 100) / 100)
          where id = p_account_id;
      else
        update public.accounts
          set current_debt_usd = round((coalesce(current_debt_usd, 0) + p_amount) * 100) / 100
          where id = p_account_id;
      end if;
    else
      if p_type = 'expense' then
        update public.accounts
          set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) - p_amount) * 100) / 100),
              current_debt = greatest(0, round((coalesce(current_debt, 0) - p_amount) * 100) / 100)
          where id = p_account_id;
      else
        update public.accounts
          set current_debt_dop = round((coalesce(current_debt_dop, 0) + p_amount) * 100) / 100,
              current_debt = round((coalesce(current_debt, 0) + p_amount) * 100) / 100
          where id = p_account_id;
      end if;
    end if;
  else
    -- Non-credit: expense decreases balance, income increases balance.
    -- To reverse: opposite direction.
    if p_type = 'expense' then
      update public.accounts
        set balance = round((balance + p_amount) * 100) / 100
        where id = p_account_id;
    else
      update public.accounts
        set balance = round((balance - p_amount) * 100) / 100
        where id = p_account_id;
    end if;
  end if;
end;
$func$;

-- ══════════════════════════════════════════════════════
-- Helper: apply a single transaction's impact on its account
-- (forward direction — same as create)
-- ══════════════════════════════════════════════════════
create or replace function public._apply_tx_impact(
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_acc record;
begin
  select type, currency, balance, current_debt, current_debt_dop, current_debt_usd
    into strict v_acc
    from public.accounts
    where id = p_account_id;

  if v_acc.type = 'credit' then
    if p_currency = 'USD' then
      if p_type = 'expense' then
        update public.accounts
          set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) + p_amount) * 100) / 100)
          where id = p_account_id;
      else
        update public.accounts
          set current_debt_usd = greatest(0, round((coalesce(current_debt_usd, 0) - p_amount) * 100) / 100)
          where id = p_account_id;
      end if;
    else
      if p_type = 'expense' then
        update public.accounts
          set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) + p_amount) * 100) / 100),
              current_debt = greatest(0, round((coalesce(current_debt_dop, 0) + p_amount) * 100) / 100)
          where id = p_account_id;
      else
        update public.accounts
          set current_debt_dop = greatest(0, round((coalesce(current_debt_dop, 0) - p_amount) * 100) / 100),
              current_debt = greatest(0, round((coalesce(current_debt_dop, 0) - p_amount) * 100) / 100)
          where id = p_account_id;
      end if;
    end if;
  else
    if p_type = 'expense' then
      update public.accounts
        set balance = greatest(0, round((balance - p_amount) * 100) / 100)
        where id = p_account_id;
    else
      update public.accounts
        set balance = round((balance + p_amount) * 100) / 100
        where id = p_account_id;
    end if;
  end if;
end;
$func$;

-- ══════════════════════════════════════════════════════
-- Helper: record ledger entry for a transaction impact
-- ══════════════════════════════════════════════════════
create or replace function public._record_ledger_entry(
  p_user_id uuid,
  p_account_id uuid,
  p_transaction_id uuid,
  p_amount numeric,
  p_currency text,
  p_type text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  if p_type = 'expense' then
    insert into public.ledger_entries (user_id, debit_account_id, transaction_id, amount, currency, description)
    values (p_user_id, p_account_id, p_transaction_id, p_amount, p_currency, coalesce(p_description, ''));
  else
    insert into public.ledger_entries (user_id, credit_account_id, transaction_id, amount, currency, description)
    values (p_user_id, p_account_id, p_transaction_id, p_amount, p_currency, coalesce(p_description, ''));
  end if;
end;
$func$;

-- ══════════════════════════════════════════════════════
-- Helper: reverse ledger entry for a transaction
-- ══════════════════════════════════════════════════════
create or replace function public._reverse_ledger_entry(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  delete from public.ledger_entries
  where transaction_id = p_transaction_id;
end;
$func$;

-- ════════════════════════════════════════════════════════════════
-- delete_transaction_safe
-- Atomically deletes a transaction and reverses all impacts.
-- Handles:
--   - Regular expense/income
--   - Transfer (both source + dest + commission + transfer record)
--   - Credit card payment (full payment group)
--   - Debt payment (restore debt balance)
--   - Commission child
-- ════════════════════════════════════════════════════════════════
create or replace function public.delete_transaction_safe(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user_id uuid;
  v_tx record;
  v_meta jsonb;
  v_kind text;
  v_transfer_id uuid;
  v_related_txs uuid[];
  v_tid uuid;
  v_commission record;
  v_debt_payment record;
  v_payment_group_id text;
  v_group_txs record;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Load transaction
  select * into strict v_tx
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id;

  v_meta := coalesce(v_tx.metadata, '{}'::jsonb);
  v_kind := v_meta->>'kind';

  -- ── CASE: Commission child ──
  -- Just delete it; the parent transaction's delete handles the account impact.
  if v_kind = 'commission' then
    delete from public.transactions where id = p_transaction_id;
    return jsonb_build_object('action', 'deleted_commission', 'transaction_id', p_transaction_id);
  end if;

  -- ── CASE: Transfer transaction ──
  if v_kind = 'transfer' then
    v_transfer_id := (v_meta->>'transfer_id')::uuid;
    if v_transfer_id is null then
      raise exception 'Transferencia sin transfer_id en metadata';
    end if;

    -- Collect ALL transaction IDs linked to this transfer (source + dest + commission)
    v_related_txs := array_agg(id) from public.transactions
      where (metadata->>'transfer_id')::uuid = v_transfer_id
        and user_id = v_user_id;

    -- Reverse impact for ALL related transactions
    foreach v_tid in array v_related_txs
    loop
      select * into v_tx from public.transactions where id = v_tid;
      perform public._reverse_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
      perform public._reverse_ledger_entry(v_tid);
    end loop;

    -- Delete ALL related transactions
    delete from public.transactions
    where id = any(v_related_txs);

    -- Delete the transfer record
    delete from public.transfers
    where id = v_transfer_id and user_id = v_user_id;

    return jsonb_build_object(
      'action', 'deleted_transfer',
      'transfer_id', v_transfer_id,
      'deleted_transactions', v_related_txs
    );
  end if;

  -- ── CASE: Credit card payment ──
  if v_kind = 'credit_payment' then
    v_payment_group_id := v_meta->>'payment_group_id';
    if v_payment_group_id is null then
      -- Fallback: try payment_id
      v_payment_group_id := v_meta->>'payment_id';
    end if;

    if v_payment_group_id is not null then
      -- Collect ALL transactions in this payment group
      for v_group_txs in
        select id, account_id, type, amount, currency
        from public.transactions
        where metadata->>'payment_group_id' = v_payment_group_id
           or metadata->>'payment_id' = v_payment_group_id
        loop
          perform public._reverse_tx_impact(v_group_txs.account_id, v_group_txs.type, v_group_txs.amount, v_group_txs.currency);
          perform public._reverse_ledger_entry(v_group_txs.id);
        end loop;

      -- Delete all payment group transactions
      delete from public.transactions
      where metadata->>'payment_group_id' = v_payment_group_id
         or metadata->>'payment_id' = v_payment_group_id;

      -- Delete the credit_payment record
      delete from public.credit_payments
      where id = v_payment_group_id::uuid;

      -- Clean up linked notifications
      delete from public.notifications
      where type = 'credit'
        and user_id = v_user_id
        and (metadata->>'payment_group_id' = v_payment_group_id
          or metadata->>'payment_id' = v_payment_group_id);
    end if;

    return jsonb_build_object('action', 'deleted_credit_payment', 'payment_group_id', v_payment_group_id);
  end if;

  -- ── CASE: Debt payment ──
  if v_kind = 'debt_payment' then
    -- Restore the debt's previous balance
    select dp.* into strict v_debt_payment
    from public.debt_payments dp
    where dp.id = (v_meta->>'debt_payment_id')::uuid;

    update public.debts
    set current_balance = v_debt_payment.previous_debt_balance,
        is_active = true,
        updated_at = now()
    where id = (v_meta->>'debt_id')::uuid;

    -- Delete the debt payment record
    delete from public.debt_payments where id = v_debt_payment.id;
  end if;

  -- ── CASE: Regular transaction (expense/income) ──
  -- Handle commission child
  for v_commission in
    select * from public.transactions
    where parent_transaction_id = p_transaction_id
      and metadata->>'kind' = 'commission'
  loop
    perform public._reverse_tx_impact(v_commission.account_id, v_commission.type, v_commission.amount, v_commission.currency);
    perform public._reverse_ledger_entry(v_commission.id);
    delete from public.transactions where id = v_commission.id;
  end loop;

  -- Reverse parent transaction impact
  perform public._reverse_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
  perform public._reverse_ledger_entry(p_transaction_id);

  -- Delete the transaction itself
  delete from public.transactions where id = p_transaction_id;

  return jsonb_build_object(
    'action', 'deleted',
    'transaction_id', p_transaction_id,
    'kind', v_kind
  );
end;
$func$;

-- ════════════════════════════════════════════════════════════════
-- update_transaction_safe
-- Atomically updates a regular transaction (expense/income).
-- Reverses old impact → applies new impact → updates row → handles commission.
-- For complex types (transfer, credit_payment), raises an error:
-- the client must use delete + recreate via the specialized RPC.
-- ════════════════════════════════════════════════════════════════
create or replace function public.update_transaction_safe(
  p_transaction_id uuid,
  p_account_id uuid default null,
  p_type text default null,
  p_amount numeric default null,
  p_currency text default null,
  p_description text default null,
  p_date date default null,
  p_category_id uuid default null,
  p_notes text default null,
  p_amount_base numeric default null,
  p_exchange_rate numeric default null,
  p_is_recurring boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user_id uuid;
  v_old record;
  v_meta jsonb;
  v_kind text;
  v_new_account_id uuid;
  v_new_type text;
  v_new_amount numeric;
  v_new_currency text;
  v_new_date date;
  v_new_description text;
  v_new_category_id uuid;
  v_new_notes text;
  v_new_amount_base numeric;
  v_new_exchange_rate numeric;
  v_new_is_recurring boolean;
  v_commission record;
  v_commission_amount numeric;
  v_commission_category_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Load existing transaction
  select * into strict v_old
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id;

  v_meta := coalesce(v_old.metadata, '{}'::jsonb);
  v_kind := v_meta->>'kind';

  -- Reject complex types that must be deleted+recreated
  if v_kind in ('transfer', 'credit_payment') then
    raise exception 'Esta transacción no puede editarse directamente. Elimínala y créala de nuevo.';
  end if;

  -- Resolve new values (coalesce with old)
  v_new_account_id := coalesce(p_account_id, v_old.account_id);
  v_new_type := coalesce(p_type, v_old.type);
  v_new_amount := coalesce(p_amount, v_old.amount);
  v_new_currency := coalesce(p_currency, v_old.currency);
  v_new_date := coalesce(p_date, v_old.date::date);
  v_new_description := coalesce(p_description, v_old.description);
  v_new_category_id := coalesce(p_category_id, v_old.category_id);
  v_new_notes := coalesce(p_notes, v_old.notes);
  v_new_amount_base := coalesce(p_amount_base, v_old.amount_base);
  v_new_exchange_rate := coalesce(p_exchange_rate, v_old.exchange_rate);
  v_new_is_recurring := coalesce(p_is_recurring, v_old.is_recurring);

  -- Validate new currency matches new account (for non-credit)
  declare
    v_new_acc_type text;
    v_new_acc_currency text;
  begin
    select type, currency into strict v_new_acc_type, v_new_acc_currency
    from public.accounts where id = v_new_account_id;

    if v_new_acc_type != 'credit' and v_new_currency != v_new_acc_currency then
      raise exception 'La moneda de la transacción no coincide con la de la cuenta.';
    end if;
  end;

  -- ════════════════════════════════════════════
  -- ATOMIC BLOCK: reverse old → apply new → update
  -- ════════════════════════════════════════════

  -- Step 1: Handle old commission child (reverse + will be replaced)
  select * into v_commission
  from public.transactions
  where parent_transaction_id = p_transaction_id
    and metadata->>'kind' = 'commission';

  if v_commission.id is not null then
    perform public._reverse_tx_impact(v_commission.account_id, v_commission.type, v_commission.amount, v_commission.currency);
    perform public._reverse_ledger_entry(v_commission.id);
    delete from public.transactions where id = v_commission.id;
  end if;

  -- Step 2: Reverse old account impact (if account changed, reverse old account)
  if v_old.account_id != v_new_account_id or v_old.type != v_new_type or v_old.amount != v_new_amount or v_old.currency != v_new_currency then
    perform public._reverse_tx_impact(v_old.account_id, v_old.type, v_old.amount, v_old.currency);
    perform public._reverse_ledger_entry(p_transaction_id);
  end if;

  -- Step 3: Apply new impact (if anything changed)
  if v_old.account_id != v_new_account_id or v_old.type != v_new_type or v_old.amount != v_new_amount or v_old.currency != v_new_currency then
    perform public._apply_tx_impact(v_new_account_id, v_new_type, v_new_amount, v_new_currency);
    perform public._record_ledger_entry(v_user_id, v_new_account_id, p_transaction_id, v_new_amount, v_new_currency, v_new_type, v_new_description);
  end if;

  -- Step 4: Update the transaction row
  update public.transactions
  set account_id = v_new_account_id,
      type = v_new_type,
      amount = v_new_amount,
      currency = v_new_currency,
      date = v_new_date,
      description = v_new_description,
      category_id = v_new_category_id,
      notes = v_new_notes,
      amount_base = v_new_amount_base,
      exchange_rate = v_new_exchange_rate,
      is_recurring = v_new_is_recurring
  where id = p_transaction_id;

  -- Step 5: Create new commission if the transaction type is expense and amount > 0
  v_commission_amount := 0;
  if v_new_type = 'expense' then
    v_commission_amount := round(v_new_amount * 0.0020 * 100) / 100;
  end if;

  if v_commission_amount > 0 then
    -- Find or create commission category
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

    -- Insert new commission transaction
    insert into public.transactions (user_id, account_id, category_id, type, amount, currency, amount_base, exchange_rate, description, date, parent_transaction_id, metadata)
    values (
      v_user_id, v_new_account_id, v_commission_category_id, 'expense', v_commission_amount, v_new_currency, v_commission_amount, 1,
      'Comisión de 0.15% de ' || coalesce(v_new_description, 'transacción'),
      v_new_date, p_transaction_id,
      jsonb_build_object('kind', 'commission', 'rate', 0.0020)
    )
    returning id into v_commission_category_id; -- reuse var, now holds commission tx id

    -- Apply commission impact
    perform public._apply_tx_impact(v_new_account_id, 'expense', v_commission_amount, v_new_currency);
    perform public._record_ledger_entry(v_user_id, v_new_account_id, v_commission_category_id, v_commission_amount, v_new_currency, 'expense', 'Comisión');
  end if;

  -- Handle debt payment update
  if v_kind = 'debt_payment' then
    declare
      v_debt_payment record;
      v_balance_diff numeric;
    begin
      select * into strict v_debt_payment
      from public.debt_payments
      where id = (v_meta->>'debt_payment_id')::uuid;

      v_balance_diff := round((v_new_amount - v_old.amount) * 100) / 100;

      if v_balance_diff != 0 then
        update public.debts
        set current_balance = round((coalesce(current_balance, 0) + v_balance_diff) * 100) / 100,
            updated_at = now()
        where id = (v_meta->>'debt_id')::uuid;
      end if;
    end;
  end if;

  return jsonb_build_object(
    'action', 'updated',
    'transaction_id', p_transaction_id
  );
end;
$func$;
