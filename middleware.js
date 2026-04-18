import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

const PUBLIC_ROUTES     = ['/login']
const PUBLIC_API_ROUTES = ['/api/users/seed', '/api/users/ensure-profile', '/api/health']

export async function middleware(req) {
  const res      = NextResponse.next()
  const pathname = req.nextUrl.pathname

  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '?'))) return res
  if (PUBLIC_API_ROUTES.some(r => pathname.startsWith(r))) return res

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) return res

  try {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const loginUrl = new URL('/login', req.url)
      if (pathname !== '/login') loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return res
  } catch (e) {
    console.error('[Middleware] Error:', e.message)
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
