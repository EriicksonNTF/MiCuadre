-- Account branding fields for personalized cards

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS icon_type TEXT CHECK (icon_type IN ('emoji', 'icon', 'image')),
  ADD COLUMN IF NOT EXISTS icon_value TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS background_style TEXT;

UPDATE public.accounts
SET
  icon_type = COALESCE(icon_type, 'icon'),
  icon_value = COALESCE(
    icon_value,
    CASE
      WHEN type = 'cash' THEN 'banknote'
      WHEN type = 'credit' THEN 'credit-card'
      ELSE 'building-2'
    END
  ),
  primary_color = COALESCE(
    primary_color,
    CASE
      WHEN type = 'cash' THEN '#0f766e'
      WHEN type = 'credit' THEN '#07111f'
      ELSE '#0b4a8a'
    END
  ),
  secondary_color = COALESCE(
    secondary_color,
    CASE
      WHEN type = 'cash' THEN '#14b8a6'
      WHEN type = 'credit' THEN '#0ea5e9'
      ELSE '#38bdf8'
    END
  ),
  background_style = COALESCE(background_style, 'gradient')
WHERE TRUE;

COMMIT;
