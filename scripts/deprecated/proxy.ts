import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon/manifest/service worker/static files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|.*\\.(?:js|css|mjs|map|json|woff2?|svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
