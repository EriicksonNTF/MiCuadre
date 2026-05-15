-- 1. Fix: function_search_path_mutable for update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Fix: Prevent handle_new_user from being executed via RPC by clients
-- By default, functions in 'public' schema are executable by PUBLIC.
-- We revoke EXECUTE from PUBLIC and anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
-- Only postgres (admin) or supabase_admin should execute it (usually trigger runs as table owner)

-- 3. Fix: public_bucket_allows_listing for account-logos and avatars
-- We need to update the storage policies to prevent listing but allow getting objects.
-- A public bucket inherently allows GET on object without a policy for public URL access,
-- but if we have a SELECT policy without a specific path check, it allows listing the whole bucket.

-- Drop the overly broad policies if they exist
DROP POLICY IF EXISTS "account_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Account logos are publicly accessible." ON storage.objects;

-- Recreate policies for read access but restrict them so they don't allow listing the root bucket.
-- Often for public buckets, you don't even need a SELECT policy on storage.objects to access via getPublicUrl.
-- But if you do need it for the API (supabase.storage.from().download()), we can restrict it.
-- Actually, the Supabase recommendation is to drop broad SELECT policies for public buckets.
-- Public buckets allow downloading via `/storage/v1/object/public/...` without any RLS policy.
-- So dropping them is usually enough to fix the listing issue while keeping images accessible.
