-- =====================================================
-- 042_edit_delete_v2.sql
-- Soft-delete, undelete, preview, and enhanced update.
-- - Adds deleted_at column to transactions
-- - Modifies delete_transaction_safe to soft-delete
-- - Adds undelete_transaction_safe RPC
-- - Adds update_transaction_preview RPC
-- - Enhances update_transaction_safe for all types
-- =====================================================

-- ══════════════════════════════════════════════════════
-- 1. Add deleted_at column to transactions
-- ══════════════════════════════════════════════════════
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
ON public.transactions(deleted_at)
WHERE deleted_at IS NULL;

-- ══════════════════════════════════════════════════════
-- 2. Replace delete_transaction_safe with soft-delete version
--    Uses SET deleted_at = now() instead of DELETE.
-- ══════════════════════════════════════════════════════
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

  -- Load transaction (only if not already deleted)
  select * into strict v_tx
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id
    and deleted_at is null;

  v_meta := coalesce(v_tx.metadata, '{}'::jsonb);
  v_kind := v_meta->>'kind';

  -- ── CASE: Commission child ──
  if v_kind = 'commission' then
    update public.transactions set deleted_at = now() where id = p_transaction_id;
    return jsonb_build_object('action', 'deleted_commission', 'transaction_id', p_transaction_id);
  end if;

  -- ── CASE: Transfer transaction ──
  if v_kind = 'transfer' then
    v_transfer_id := (v_meta->>'transfer_id')::uuid;
    if v_transfer_id is null then
      raise exception 'Transferencia sin transfer_id en metadata';
    end if;

    -- Collect ALL transaction IDs linked to this transfer
    v_related_txs := array_agg(id) from public.transactions
      where (metadata->>'transfer_id')::uuid = v_transfer_id
        and user_id = v_user_id
        and deleted_at is null;

    -- Reverse impact for ALL related transactions
    foreach v_tid in array v_related_txs
    loop
      select * into v_tx from public.transactions where id = v_tid;
      perform public._reverse_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
      perform public._reverse_ledger_entry(v_tid);
    end loop;

    -- Soft-delete ALL related transactions
    update public.transactions
    set deleted_at = now()
    where id = any(v_related_txs);

    -- Soft-delete the transfer record
    update public.transfers
    set deleted_at = now()
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
      v_payment_group_id := v_meta->>'payment_id';
    end if;

    if v_payment_group_id is not null then
      -- Reverse impact for ALL transactions in this payment group
      for v_group_txs in
        select id, account_id, type, amount, currency
        from public.transactions
        where (metadata->>'payment_group_id' = v_payment_group_id
           or metadata->>'payment_id' = v_payment_group_id)
          and deleted_at is null
        loop
          perform public._reverse_tx_impact(v_group_txs.account_id, v_group_txs.type, v_group_txs.amount, v_group_txs.currency);
          perform public._reverse_ledger_entry(v_group_txs.id);
        end loop;

      -- Handle commission children of payment group transactions
      for v_commission in
        select c.id, c.account_id, c.type, c.amount, c.currency
        from public.transactions c
        join public.transactions pt on pt.id = c.parent_transaction_id
        where (pt.metadata->>'payment_group_id' = v_payment_group_id
           or pt.metadata->>'payment_id' = v_payment_group_id)
          and c.metadata->>'kind' = 'commission'
          and c.deleted_at is null
        loop
          perform public._reverse_tx_impact(v_commission.account_id, v_commission.type, v_commission.amount, v_commission.currency);
          perform public._reverse_ledger_entry(v_commission.id);
        end loop;

      -- Soft-delete all payment group transactions + their commissions
      update public.transactions
      set deleted_at = now()
      where metadata->>'payment_group_id' = v_payment_group_id
         or metadata->>'payment_id' = v_payment_group_id
         or id in (
           select c.id from public.transactions c
           join public.transactions pt on pt.id = c.parent_transaction_id
           where (pt.metadata->>'payment_group_id' = v_payment_group_id
              or pt.metadata->>'payment_id' = v_payment_group_id)
             and c.metadata->>'kind' = 'commission'
         );

      -- Soft-delete the credit_payment record
      update public.credit_payments
      set deleted_at = now()
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
    select dp.* into strict v_debt_payment
    from public.debt_payments dp
    where dp.id = (v_meta->>'debt_payment_id')::uuid;

    update public.debts
    set current_balance = v_debt_payment.previous_debt_balance,
        is_active = true,
        updated_at = now()
    where id = (v_meta->>'debt_id')::uuid;

    -- Soft-delete the debt payment record
    update public.debt_payments
    set deleted_at = now()
    where id = v_debt_payment.id;
  end if;

  -- ── CASE: Regular transaction (expense/income) ──
  -- Handle commission child
  for v_commission in
    select * from public.transactions
    where parent_transaction_id = p_transaction_id
      and metadata->>'kind' = 'commission'
      and deleted_at is null
  loop
    perform public._reverse_tx_impact(v_commission.account_id, v_commission.type, v_commission.amount, v_commission.currency);
    perform public._reverse_ledger_entry(v_commission.id);
    update public.transactions set deleted_at = now() where id = v_commission.id;
  end loop;

  -- Reverse parent transaction impact
  perform public._reverse_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
  perform public._reverse_ledger_entry(p_transaction_id);

  -- Soft-delete the transaction itself
  update public.transactions set deleted_at = now() where id = p_transaction_id;

  return jsonb_build_object(
    'action', 'deleted',
    'transaction_id', p_transaction_id,
    'kind', v_kind
  );
end;
$func$;

-- ══════════════════════════════════════════════════════
-- 3. undelete_transaction_safe
--    Reverses a soft-delete: re-applies impacts and clears deleted_at.
-- ══════════════════════════════════════════════════════
create or replace function public.undelete_transaction_safe(
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
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Load transaction (only if deleted)
  select * into strict v_tx
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id
    and deleted_at is not null;

  v_meta := coalesce(v_tx.metadata, '{}'::jsonb);
  v_kind := v_meta->>'kind';

  -- ── CASE: Commission child ──
  if v_kind = 'commission' then
    update public.transactions set deleted_at = null where id = p_transaction_id;
    return jsonb_build_object('action', 'undeleted_commission', 'transaction_id', p_transaction_id);
  end if;

  -- ── CASE: Transfer transaction ──
  if v_kind = 'transfer' then
    v_transfer_id := (v_meta->>'transfer_id')::uuid;
    if v_transfer_id is null then
      raise exception 'Transferencia sin transfer_id en metadata';
    end if;

    -- Collect ALL soft-deleted transaction IDs linked to this transfer
    v_related_txs := array_agg(id) from public.transactions
      where (metadata->>'transfer_id')::uuid = v_transfer_id
        and user_id = v_user_id
        and deleted_at is not null;

    -- Re-apply impact for ALL related transactions
    foreach v_tid in array v_related_txs
    loop
      select * into v_tx from public.transactions where id = v_tid;
      perform public._apply_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
      perform public._record_ledger_entry(v_user_id, v_tx.account_id, v_tid, v_tx.amount, v_tx.currency, v_tx.type, v_tx.description);
    end loop;

    -- Restore ALL related transactions
    update public.transactions
    set deleted_at = null
    where id = any(v_related_txs);

    -- Restore the transfer record
    update public.transfers
    set deleted_at = null
    where id = v_transfer_id and user_id = v_user_id;

    return jsonb_build_object(
      'action', 'undeleted_transfer',
      'transfer_id', v_transfer_id,
      'restored_transactions', v_related_txs
    );
  end if;

  -- ── CASE: Credit card payment ──
  if v_kind = 'credit_payment' then
    v_payment_group_id := v_meta->>'payment_group_id';
    if v_payment_group_id is null then
      v_payment_group_id := v_meta->>'payment_id';
    end if;

    if v_payment_group_id is not null then
      -- Re-apply impact for ALL transactions in this payment group
      for v_group_txs in
        select id, account_id, type, amount, currency, description
        from public.transactions
        where (metadata->>'payment_group_id' = v_payment_group_id
           or metadata->>'payment_id' = v_payment_group_id)
          and deleted_at is not null
        loop
          perform public._apply_tx_impact(v_group_txs.account_id, v_group_txs.type, v_group_txs.amount, v_group_txs.currency);
          perform public._record_ledger_entry(v_user_id, v_group_txs.account_id, v_group_txs.id, v_group_txs.amount, v_group_txs.currency, v_group_txs.type, v_group_txs.description);
        end loop;

      -- Restore all payment group transactions
      update public.transactions
      set deleted_at = null
      where metadata->>'payment_group_id' = v_payment_group_id
         or metadata->>'payment_id' = v_payment_group_id;

      -- Restore the credit_payment record
      update public.credit_payments
      set deleted_at = null
      where id = v_payment_group_id::uuid;
    end if;

    return jsonb_build_object('action', 'undeleted_credit_payment', 'payment_group_id', v_payment_group_id);
  end if;

  -- ── CASE: Debt payment ──
  if v_kind = 'debt_payment' then
    select dp.* into strict v_debt_payment
    from public.debt_payments dp
    where dp.id = (v_meta->>'debt_payment_id')::uuid
      and dp.deleted_at is not null;

    -- Re-apply the debt payment impact
    update public.debts
    set current_balance = round((coalesce(current_balance, 0) - v_debt_payment.amount) * 100) / 100,
        updated_at = now()
    where id = (v_meta->>'debt_id')::uuid;

    -- Restore the debt payment record
    update public.debt_payments
    set deleted_at = null
    where id = v_debt_payment.id;
  end if;

  -- ── CASE: Regular transaction (expense/income) ──
  -- Restore commission child
  for v_commission in
    select * from public.transactions
    where parent_transaction_id = p_transaction_id
      and metadata->>'kind' = 'commission'
      and deleted_at is not null
  loop
    update public.transactions set deleted_at = null where id = v_commission.id;
    perform public._apply_tx_impact(v_commission.account_id, v_commission.type, v_commission.amount, v_commission.currency);
    perform public._record_ledger_entry(v_user_id, v_commission.account_id, v_commission.id, v_commission.amount, v_commission.currency, v_commission.type, v_commission.description);
  end loop;

  -- Re-apply parent transaction impact
  perform public._apply_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
  perform public._record_ledger_entry(v_user_id, v_tx.account_id, p_transaction_id, v_tx.amount, v_tx.currency, v_tx.type, v_tx.description);

  -- Restore the transaction itself
  update public.transactions set deleted_at = null where id = p_transaction_id;

  return jsonb_build_object(
    'action', 'undeleted',
    'transaction_id', p_transaction_id,
    'kind', v_kind
  );
end;
$func$;

-- ══════════════════════════════════════════════════════
-- 4. update_transaction_preview
--    Calculates what would change WITHOUT modifying anything.
--    Returns JSON with old/new values, balance impact, commission diff.
-- ══════════════════════════════════════════════════════
create or replace function public.update_transaction_preview(
  p_transaction_id uuid,
  p_amount numeric default null,
  p_description text default null,
  p_date date default null,
  p_category_id uuid default null,
  p_notes text default null,
  p_currency text default null
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
  v_new_amount numeric;
  v_new_currency text;
  v_new_date date;
  v_new_description text;
  v_new_category_id uuid;
  v_new_notes text;
  v_amount_diff numeric;
  v_new_commission numeric;
  v_old_commission numeric;
  v_linked_accounts jsonb;
  v_linked jsonb;
  v_source_account record;
  v_dest_account record;
  v_debt_payment record;
  v_debt record;
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

  -- Resolve new values
  v_new_amount := coalesce(p_amount, v_old.amount);
  v_new_currency := coalesce(p_currency, v_old.currency);
  v_new_date := coalesce(p_date, v_old.date::date);
  v_new_description := coalesce(p_description, v_old.description);
  v_new_category_id := coalesce(p_category_id, v_old.category_id);
  v_new_notes := coalesce(p_notes, v_old.notes);

  v_amount_diff := round((v_new_amount - v_old.amount) * 100) / 100;

  -- Calculate commission (0.15% of amount for expenses)
  v_old_commission := 0;
  v_new_commission := 0;
  if v_old.type = 'expense' then
    select coalesce(amount, 0) into v_old_commission
    from public.transactions
    where parent_transaction_id = p_transaction_id
      and metadata->>'kind' = 'commission';
    v_new_commission := round(v_new_amount * 0.0015 * 100) / 100;
  end if;

  -- Build response base
  v_linked_accounts := '[]'::jsonb;

  -- For transfers, include both accounts
  if v_kind = 'transfer' then
    select a.id, a.name, a.balance into strict v_source_account
    from public.accounts a
    join public.transactions t on t.account_id = a.id
    where t.id = p_transaction_id;

    select a.id, a.name, a.balance into v_dest_account
    from public.accounts a
    join public.transactions t on t.account_id = a.id
    where t.parent_transaction_id = p_transaction_id
       or (t.metadata->>'transfer_id' = v_meta->>'transfer_id' and t.id != p_transaction_id)
    limit 1;

    v_linked_accounts := jsonb_build_array(
      jsonb_build_object(
        'id', v_source_account.id,
        'name', v_source_account.name,
        'old_balance', v_source_account.balance,
        'new_balance', case
          when v_old.type = 'expense' then round((v_source_account.balance + v_amount_diff) * 100) / 100
          else round((v_source_account.balance - v_amount_diff) * 100) / 100
        end
      )
    );

    if v_dest_account.id is not null then
      v_linked_accounts := v_linked_accounts || jsonb_build_object(
        'id', v_dest_account.id,
        'name', v_dest_account.name,
        'old_balance', v_dest_account.balance,
        'new_balance', case
          when v_old.type = 'expense' then round((v_dest_account.balance - v_amount_diff) * 100) / 100
          else round((v_dest_account.balance + v_amount_diff) * 100) / 100
        end
      );
    end if;
  end if;

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'kind', v_kind,
    'old_amount', v_old.amount,
    'new_amount', v_new_amount,
    'amount_diff', v_amount_diff,
    'old_currency', v_old.currency,
    'new_currency', v_new_currency,
    'old_description', v_old.description,
    'new_description', v_new_description,
    'old_commission', v_old_commission,
    'new_commission', v_new_commission,
    'commission_action', case
      when v_old_commission = 0 and v_new_commission > 0 then 'create'
      when v_old_commission > 0 and v_new_commission = 0 then 'remove'
      when abs(v_old_commission - v_new_commission) > 0.01 then 'recalculate'
      else 'unchanged'
    end,
    'linked_accounts', v_linked_accounts
  );
end;
$func$;

-- ══════════════════════════════════════════════════════
-- 5. Enhanced update_transaction_safe
--    Now handles credit_card_income, debt_payment, and removes
--    the blanket rejection of transfers/credit_payments.
--    For complex types, calls specialized handlers.
-- ══════════════════════════════════════════════════════
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
  p_is_recurring boolean default null,
  p_metadata jsonb default null
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
  v_new_metadata jsonb;
  v_commission record;
  v_commission_amount numeric;
  v_commission_category_id uuid;
  v_result jsonb;
  v_transfer_id uuid;
  v_payment_group_id text;
  v_debt_payment record;
  v_balance_diff numeric;
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

  -- For complex types, delegate to specialized handlers
  -- Transfer: edit only amount, description, date (not accounts)
  if v_kind = 'transfer' then
    v_transfer_id := (v_meta->>'transfer_id')::uuid;
    if v_transfer_id is null then
      raise exception 'Transferencia sin transfer_id en metadata';
    end if;

    -- Only allow amount, description, date changes for transfers
    if p_amount is not null or p_description is not null or p_date is not null then
      v_new_amount := coalesce(p_amount, v_old.amount);
      v_new_description := coalesce(p_description, v_old.description);
      v_new_date := coalesce(p_date, v_old.date::date);

      -- Calculate diff
      v_balance_diff := round((v_new_amount - v_old.amount) * 100) / 100;

      if v_balance_diff != 0 then
        -- Update ALL linked transfer transactions
        declare
          v_tx record;
        begin
          for v_tx in
            select id, account_id, type, amount, currency
            from public.transactions
            where (metadata->>'transfer_id')::uuid = v_transfer_id
              and user_id = v_user_id
          loop
            -- Reverse old impact
            perform public._reverse_tx_impact(v_tx.account_id, v_tx.type, v_tx.amount, v_tx.currency);
            perform public._reverse_ledger_entry(v_tx.id);

            -- Apply new impact
            perform public._apply_tx_impact(v_tx.account_id, v_tx.type, v_new_amount, v_tx.currency);

            -- Update transaction row
            update public.transactions
            set amount = v_new_amount,
                description = v_new_description,
                date = v_new_date
            where id = v_tx.id;

            -- Record new ledger entry
            perform public._record_ledger_entry(v_user_id, v_tx.account_id, v_tx.id, v_new_amount, v_tx.currency, v_tx.type, v_new_description);
          end loop;
        end;
      else
        -- Only description/date changed, no amount change
        update public.transactions
        set description = v_new_description,
            date = v_new_date
        where (metadata->>'transfer_id')::uuid = v_transfer_id
          and user_id = v_user_id;
      end if;
    end if;

    return jsonb_build_object('action', 'updated_transfer', 'transaction_id', p_transaction_id);
  end if;

  -- Credit payment: edit only amount, date
  if v_kind = 'credit_payment' then
    v_payment_group_id := v_meta->>'payment_group_id';
    if v_payment_group_id is null then
      v_payment_group_id := v_meta->>'payment_id';
    end if;

    if p_amount is not null or p_date is not null then
      v_new_amount := coalesce(p_amount, v_old.amount);
      v_new_date := coalesce(p_date, v_old.date::date);

      v_balance_diff := round((v_new_amount - v_old.amount) * 100) / 100;

      if v_balance_diff != 0 then
        declare
          v_ptx record;
        begin
          for v_ptx in
            select id, account_id, type, amount, currency
            from public.transactions
            where (metadata->>'payment_group_id' = v_payment_group_id
               or metadata->>'payment_id' = v_payment_group_id)
              and user_id = v_user_id
          loop
            perform public._reverse_tx_impact(v_ptx.account_id, v_ptx.type, v_ptx.amount, v_ptx.currency);
            perform public._reverse_ledger_entry(v_ptx.id);
            perform public._apply_tx_impact(v_ptx.account_id, v_ptx.type, v_new_amount, v_ptx.currency);

            update public.transactions
            set amount = v_new_amount,
                date = v_new_date
            where id = v_ptx.id;

            perform public._record_ledger_entry(v_user_id, v_ptx.account_id, v_ptx.id, v_new_amount, v_ptx.currency, v_ptx.type, v_ptx.description);
          end loop;
        end;
      else
        update public.transactions
        set date = v_new_date
        where (metadata->>'payment_group_id' = v_payment_group_id
           or metadata->>'payment_id' = v_payment_group_id)
          and user_id = v_user_id;
      end if;
    end if;

    return jsonb_build_object('action', 'updated_credit_payment', 'transaction_id', p_transaction_id);
  end if;

  -- Debt payment: edit amount (balance diff handled below)
  -- Credit card income: edit amount, description, category, notes

  -- Resolve new values
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
  v_new_metadata := coalesce(p_metadata, v_old.metadata);

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

  -- Step 2: Reverse old account impact (if changed)
  if v_old.account_id != v_new_account_id or v_old.type != v_new_type or v_old.amount != v_new_amount or v_old.currency != v_new_currency then
    perform public._reverse_tx_impact(v_old.account_id, v_old.type, v_old.amount, v_old.currency);
    perform public._reverse_ledger_entry(p_transaction_id);
  end if;

  -- Step 3: Apply new impact (if changed)
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
      is_recurring = v_new_is_recurring,
      metadata = v_new_metadata
  where id = p_transaction_id;

  -- Step 5: Create/update commission if expense
  v_commission_amount := 0;
  if v_new_type = 'expense' then
    v_commission_amount := round(v_new_amount * 0.0015 * 100) / 100;
  end if;

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
      v_user_id, v_new_account_id, v_commission_category_id, 'expense', v_commission_amount, v_new_currency, v_commission_amount, 1,
      'Comisión de 0.15% de ' || coalesce(v_new_description, 'transacción'),
      v_new_date, p_transaction_id,
      jsonb_build_object('kind', 'commission', 'rate', 0.0015)
    )
    returning id into v_commission_category_id;

    perform public._apply_tx_impact(v_new_account_id, 'expense', v_commission_amount, v_new_currency);
    perform public._record_ledger_entry(v_user_id, v_new_account_id, v_commission_category_id, v_commission_amount, v_new_currency, 'expense', 'Comisión');
  end if;

  -- Handle debt payment balance diff
  if v_kind = 'debt_payment' then
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
  end if;

  return jsonb_build_object(
    'action', 'updated',
    'transaction_id', p_transaction_id
  );
end;
$func$;

-- ══════════════════════════════════════════════════════
-- 6. Add deleted_at to related tables too
-- ══════════════════════════════════════════════════════
ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.credit_payments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.debt_payments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
