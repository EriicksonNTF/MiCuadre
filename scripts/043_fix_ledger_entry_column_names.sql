-- Fix _reverse_ledger_entry: use reference_id instead of transaction_id
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
  where reference_id = p_transaction_id;
end;
$func$;

-- Fix _record_ledger_entry: use reference_id instead of transaction_id
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
    insert into public.ledger_entries (user_id, debit_account_id, reference_id, amount, currency, description)
    values (p_user_id, p_account_id, p_transaction_id, p_amount, p_currency, coalesce(p_description, ''));
  else
    insert into public.ledger_entries (user_id, credit_account_id, reference_id, amount, currency, description)
    values (p_user_id, p_account_id, p_transaction_id, p_amount, p_currency, coalesce(p_description, ''));
  end if;
end;
$func$;
