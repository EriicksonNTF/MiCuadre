# PWA Push Notifications

MiCuadre has a service worker at `public/sw.js` and a client permission flow in Settings.

Required env vars:

```txt
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:soporte@micuadre.app
```

Run this SQL manually in Supabase:

```txt
scripts/022_avatar_storage_rls_and_push_subscriptions.sql
```

It creates `public.push_subscriptions` with RLS so users can manage only their own subscriptions.

Platform notes:

- Android/Chrome supports Web Push in normal PWA-capable browsers.
- iPhone/iPad requires iOS/iPadOS 16.4+, MiCuadre added to Home Screen, and opened from the installed PWA.
- Unsupported browsers should show a friendly message instead of requesting permission.

Current implementation:

- Registers `/sw.js`.
- Requests permission only after the user taps “Activar notificaciones”.
- Saves `endpoint`, `p256dh`, `auth`, user agent and platform to Supabase.
- Does not send push notifications yet because server sending needs `VAPID_PRIVATE_KEY` and a secure sending job/route.

Local testing:

1. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
2. Apply the SQL migration in Supabase.
3. Open Settings and tap “Activar notificaciones”.
4. Confirm that a row appears in `push_subscriptions`.

Production sending notes:

- Add a server-only sender using `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.
- Never expose the private key to client components.
- Send only user-relevant notifications after explicit permission.
