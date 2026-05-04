import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/login',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/error',
  '/auth/callback',
  '/auth/sign-up-success',
]

const protectedRoutes = [
  '/',
  '/dashboard',
  '/accounts',
  '/transactions',
  '/history',
  '/goals',
  '/settings',
  '/expense',
  '/notifications',
  '/onboarding',
  '/send',
  '/pay',
  '/profile',
  '/scan',
]

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some((route) =>
    route === '/'
      ? pathname === '/'
      : pathname === route || pathname.startsWith(`${route}/`)
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicRoute = matchesRoute(pathname, publicRoutes)
  const isProtectedRoute = matchesRoute(pathname, protectedRoutes)
  const isEmailVerified = Boolean(user?.email_confirmed_at)

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && !isEmailVerified && pathname !== '/verify-email') {
    const url = request.nextUrl.clone()
    url.pathname = '/verify-email'
    return NextResponse.redirect(url)
  }

  if (user && isEmailVerified && (isPublicRoute || pathname === '/verify-email')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
