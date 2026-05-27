-- Phase: security hardening for entitlements and anti-bypass
-- Non-destructive: additive functions + triggers

create or replace function public.app_user_plan_tier(p_user_id uuid)
returns text
language sql
stable
as $$
  select coalesce((select plan_tier from public.profiles where id = p_user_id), 'free')
$$;

create or replace function public.app_is_pro(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select public.app_user_plan_tier(p_user_id) = 'pro'
$$;

create or replace function public.app_enforce_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_plan text;
  v_count integer;
  v_today date;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  v_plan := public.app_user_plan_tier(v_uid);

  if tg_table_name = 'budgets' then
    if v_plan <> 'pro' then
      raise exception 'Tu plan actual no incluye esta función.';
    end if;
    if new.user_id <> v_uid then
      raise exception 'Operación no permitida';
    end if;
  end if;

  if tg_table_name = 'debts' then
    if v_plan <> 'pro' then
      raise exception 'Tu plan actual no incluye esta función.';
    end if;
    if new.user_id <> v_uid then
      raise exception 'Operación no permitida';
    end if;
  end if;

  if tg_table_name = 'debt_payments' then
    if v_plan <> 'pro' then
      raise exception 'Tu plan actual no incluye esta función.';
    end if;
    if new.user_id <> v_uid then
      raise exception 'Operación no permitida';
    end if;
  end if;

  if tg_table_name = 'subscriptions' then
    if new.user_id <> v_uid then
      raise exception 'Operación no permitida';
    end if;

    if v_plan <> 'pro' then
      select count(*)::int into v_count
      from public.subscriptions
      where user_id = v_uid
      and (tg_op = 'INSERT' or id <> new.id);

      if v_count >= 1 then
        raise exception 'Llegaste al límite del plan Free.';
      end if;

      if coalesce(new.auto_record_enabled, false) or coalesce(new.pre_alert_enabled, false) then
        raise exception 'La automatización de suscripciones está disponible en Pro.';
      end if;
    end if;
  end if;

  if tg_table_name = 'transactions' then
    if new.user_id <> v_uid then
      raise exception 'Operación no permitida';
    end if;

    if v_plan <> 'pro' then
      v_today := coalesce(nullif(new.date::text, '')::date, (now() at time zone 'utc')::date);
      select count(*)::int into v_count
      from public.transactions
      where user_id = v_uid
      and date = v_today
      and (tg_op = 'INSERT' or id <> new.id);

      if v_count >= 10 then
        raise exception 'Llegaste al límite de 10 transacciones diarias del plan Free.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_entitlements_transactions on public.transactions;
create trigger trg_enforce_entitlements_transactions
before insert or update on public.transactions
for each row execute function public.app_enforce_entitlements();

drop trigger if exists trg_enforce_entitlements_subscriptions on public.subscriptions;
create trigger trg_enforce_entitlements_subscriptions
before insert or update on public.subscriptions
for each row execute function public.app_enforce_entitlements();

drop trigger if exists trg_enforce_entitlements_budgets on public.budgets;
create trigger trg_enforce_entitlements_budgets
before insert or update on public.budgets
for each row execute function public.app_enforce_entitlements();

drop trigger if exists trg_enforce_entitlements_debts on public.debts;
create trigger trg_enforce_entitlements_debts
before insert or update on public.debts
for each row execute function public.app_enforce_entitlements();

drop trigger if exists trg_enforce_entitlements_debt_payments on public.debt_payments;
create trigger trg_enforce_entitlements_debt_payments
before insert or update on public.debt_payments
for each row execute function public.app_enforce_entitlements();
