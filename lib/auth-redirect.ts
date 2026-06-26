/**
 * Resuelve la URL de redirección para flujos OAuth de Supabase.
 *
 * Bajo `file://` (Capacitor / WKWebView nativo), `window.location.origin`
 * devuelve la cadena "null", lo que produce URLs de redirección rotas
 * como `null/auth/callback`. Esta función detecta ese caso y cae a una
 * URL pública válida configurada por env, o a la URL de producción.
 */
export function getAuthRedirectUrl(nextPath = "/"): string {
  // 1. Override explícito por env (útil para desarrollo / staging)
  const envOverride = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  if (envOverride) {
    return appendNext(envOverride, nextPath)
  }

  // 2. En web, usar window.location.origin (funciona en http/https)
  if (typeof window !== "undefined") {
    const origin = window.location.origin
    // Bajo file://, origin === "null" (string). No usarlo.
    if (origin && origin !== "null" && (origin.startsWith("http://") || origin.startsWith("https://"))) {
      return appendNext(`${origin}/auth/callback`, nextPath)
    }
  }

  // 3. Capacitor / file://: caer a la URL pública de la app
  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://micuadre.app"
  return appendNext(`${publicUrl}/auth/callback`, nextPath)
}

function appendNext(base: string, nextPath: string): string {
  const separator = base.includes("?") ? "&" : "?"
  return `${base}${separator}next=${encodeURIComponent(nextPath)}`
}
