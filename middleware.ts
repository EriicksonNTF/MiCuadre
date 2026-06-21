import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Run Supabase auth + route protection
  const response = await updateSession(request)

  // 2. Apply security headers to all responses
  const pathname = request.nextUrl.pathname

  // Skip security headers for static assets and API routes (they have their own handling)
  const isStaticAsset = pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/image')
  const isApiRoute = pathname.startsWith('/api/')

  if (!isStaticAsset && !isApiRoute) {
    // Content-Security-Policy
    // Allows: self, Supabase, Stripe, Vercel analytics, inline styles/scripts (Next.js requires it)
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

    // Strict-Transport-Security (only meaningful on HTTPS — Vercel provides this)
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )

    // X-Frame-Options — prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY')

    // X-Content-Type-Options — prevent MIME-type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff')

    // Referrer-Policy — limit referrer information
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Permissions-Policy — disable unnecessary browser features
    response.headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(self), payment=(self)'
    )

    // X-DNS-Prefetch-Control — reduce DNS lookups
    response.headers.set('X-DNS-Prefetch-Control', 'on')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (icons, images, sw.js, manifest.json)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|bank-logos/|landing/|Mockup%203D/|.*\\.webp|.*\\.png|.*\\.svg|.*\\.ico|.*\\.m4a).*)',
  ],
}
