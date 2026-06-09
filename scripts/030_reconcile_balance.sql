-- Phase: Account balance reconciliation via Postgres RPC
-- Recalculates the balance of a non-credit account from its transactions.
-- Idempotent: uses create or replace.

create or replace function public.reconcile_account_balance(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_account_type text;
  v_previous_balance numeric;
  v_calculated_balance numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Validate account belongs to user and is not credit
  select type, balance
    into strict v_account_type, v_previous_balance
    from public.accounts
    where id = p_account_id and user_id = v_user_id;

  if v_account_type = 'credit' then
    raise exception 'La reconciliación manual no está disponible para tarjetas de crédito (ya se recalculan automáticamente).';
  end if;

  -- Sum all transactions: income adds, expense subtracts
  select round(coalesce(sum(
    case when type = 'income' then amount else -amount end
  ), 0) * 100) / 100
  into v_calculated_balance
  from public.transactions
  where account_id = p_account_id and user_id = v_user_id;

  -- Ensure non-negative
  v_calculated_balance := greatest(0, v_calculated_balance);

  -- Update account balance
  update public.accounts
  set balance = v_calculated_balance
  where id = p_account_id and user_id = v_user_id;

  return jsonb_build_object(
    'account_id', p_account_id,
    'previous_balance', v_previous_balance,
    'new_balance', v_calculated_balance,
    'corrected', v_previous_balance != v_calculated_balance
  );
end;
$$;
