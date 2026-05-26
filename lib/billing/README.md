# Billing Domain (placeholder)

This folder is reserved for MiCuadre product monetization (Free/Pro).

- `billing_subscriptions` (future): subscription state for MiCuadre plans.
- Stripe webhook sync (future): source of truth for billing lifecycle.
- Entitlements and usage limits (future): feature access checks.

Important domain boundary:

- `financial_subscriptions` = recurring user expenses (Netflix/Spotify/etc).
- `billing_subscriptions` = MiCuadre paid plans.

Do not mix both domains.
