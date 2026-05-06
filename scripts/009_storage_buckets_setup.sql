-- Storage buckets required by avatar/account branding uploads

BEGIN;

-- Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('account-logos', 'account-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies for avatars
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policies for account logos
DROP POLICY IF EXISTS "account_logos_select_public" ON storage.objects;
CREATE POLICY "account_logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'account-logos');

DROP POLICY IF EXISTS "account_logos_insert_own" ON storage.objects;
CREATE POLICY "account_logos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'account-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "account_logos_update_own" ON storage.objects;
CREATE POLICY "account_logos_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'account-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;
