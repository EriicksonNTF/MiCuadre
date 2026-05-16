-- Optional account/card number preview support
alter table if exists public.accounts
  add column if not exists account_number text;
