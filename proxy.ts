import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.stripe.com https://js.stripe.com https://vitals.vercel-insights.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const requestWithNonce = new NextRequest(request, { headers: requestHeaders })

  const response = await updateSession(requestWithNonce)

  const pathname = request.nextUrl.pathname
  const isStaticAsset = pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/image')
  const isApiRoute = pathname.startsWith('/api/')

  if (response.status < 400 && !isStaticAsset && !isApiRoute) {
    response.headers.set('Content-Security-Policy', cspHeader)
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), payment=(self)')
    response.headers.set('X-DNS-Prefetch-Control', 'on')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|bank-logos/|landing/|Mockup%203D/|.*\\.webp|.*\\.png|.*\\.svg|.*\\.ico|.*\\.m4a).*)',
  ],
}
