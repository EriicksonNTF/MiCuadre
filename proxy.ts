import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  const pathname = request.nextUrl.pathname

  const isStaticAsset = pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/image')
  const isApiRoute = pathname.startsWith('/api/')

  if (!isStaticAsset && !isApiRoute) {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.stripe.com https://js.stripe.com https://vitals.vercel-insights.com",
        "frame-src https://js.stripe.com https://hooks.stripe.com",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
      ].join('; ')
    )

    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )

    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    response.headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(self), payment=(self)'
    )

    response.headers.set('X-DNS-Prefetch-Control', 'on')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|bank-logos/|landing/|Mockup%203D/|.*\\.webp|.*\\.png|.*\\.svg|.*\\.ico|.*\\.m4a).*)',
  ],
}
