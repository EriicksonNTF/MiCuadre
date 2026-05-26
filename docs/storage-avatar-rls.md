# Avatar Storage RLS

MiCuadre uses the Supabase Storage bucket `avatars`.

The frontend uploads avatars with this path:

```txt
{user_id}/avatar.{extension}
```

The bucket is public so the app can store `profiles.avatar_url` as a public URL and render it directly.

Run this SQL manually in Supabase:

```txt
scripts/022_avatar_storage_rls_and_push_subscriptions.sql
```

The policies allow authenticated users to insert, select, update and delete only files whose first folder matches `auth.uid()`.

Do not use the Supabase service role key in frontend code and do not disable Storage RLS.
