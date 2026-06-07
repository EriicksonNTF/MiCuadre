-- Phase: granular notification preferences per user
-- Stores boolean toggles for transactions, budgets, creditAlerts, marketing.
-- RLS-isolated per user. Backfills defaults for existing users.

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in ('transactions', 'budgets', 'creditAlerts', 'marketing')),
  value boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_delete_own on public.notification_preferences
  for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists idx_notification_preferences_user_id
  on public.notification_preferences(user_id);

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at_timestamp();

insert into public.notification_preferences (user_id, key, value)
select u.id, pref.key, true
from auth.users u
cross join (values ('transactions'), ('budgets'), ('creditAlerts'), ('marketing')) as pref(key)
on conflict (user_id, key) do nothing;
