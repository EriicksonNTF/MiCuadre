-- Bank branding support for account customization
alter table if exists public.accounts
  add column if not exists bank_name text;

alter table if exists public.accounts
  add column if not exists bank_logo_key text;

alter table if exists public.accounts
  add column if not exists bank_logo_url text;
