import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_COOKIE, sessionCookieOptions, signSession, verifySessionToken,
} from '@/lib/auth'

const PUBLIC_PATHS = [/^\/login$/, /^\/p\//]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname))
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const coachId = token ? await verifySessionToken(token) : null

  if (!coachId && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (coachId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next()
  if (coachId) {
    // sliding expiry: re-issue the cookie on every authenticated request
    response.cookies.set(SESSION_COOKIE, await signSession(coachId), sessionCookieOptions)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
