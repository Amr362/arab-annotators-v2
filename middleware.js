import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

// API routes that don't require a session check (they handle auth internally)
const PUBLIC_API_ROUTES = ['/api/users/seed']

export async function middleware(req) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Skip public pages
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r))) {
    return res
  }

  // Skip public API routes
  if (PUBLIC_API_ROUTES.some(r => pathname.startsWith(r))) {
    return res
  }

  // Skip static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return res
  }

  try {
    // Refresh session cookie on every request (keeps Supabase JWT alive)
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    // Protect all non-public routes
    if (!session) {
      const loginUrl = new URL('/login', req.url)
      // Preserve the intended destination for post-login redirect
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return res
  } catch (e) {
    // If middleware crashes, let the request through (pages handle their own auth)
    console.error('[Middleware] Error:', e.message)
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
