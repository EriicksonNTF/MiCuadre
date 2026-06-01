ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email';
