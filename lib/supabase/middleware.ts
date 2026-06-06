import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicRoutes = [
  '/',
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
  '/dashboard',
  '/accounts',
  '/transactions',
  '/history',
  '/goals',
  '/planning',
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicRoute = matchesRoute(pathname, publicRoutes)
  const isProtectedRoute = matchesRoute(pathname, protectedRoutes)
  const isEmailVerified = Boolean(user?.email_confirmed_at)

  const userAgent = request.headers.get('user-agent') || ""
  const isCapacitor = userAgent.toLowerCase().includes('capacitor') || userAgent.toLowerCase().includes('micuadrenative')

  let onboardingCompleted = false
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
    onboardingCompleted = Boolean(profile?.onboarding_completed)
  }

  if (pathname === '/' && !user && isCapacitor) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && !onboardingCompleted && pathname !== '/onboarding') {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  if (user && onboardingCompleted && pathname === '/onboarding') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && (isPublicRoute || pathname === '/verify-email')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}