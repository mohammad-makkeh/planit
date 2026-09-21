import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_COOKIE, sessionCookieOptions, signSession, verifySessionWithAge,
} from '@/lib/auth'

const PUBLIC_PATHS = [/^\/login$/, /^\/p\//]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname))
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionWithAge(token) : null
  const coachId = session?.coachId ?? null

  if (!coachId && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (coachId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next()
  if (session) {
    // sliding 1-year expiry, refreshed at most once a day — avoids the
    // set-cookie → router-refetch cascade after every server action
    const ageSeconds = Math.floor(Date.now() / 1000) - session.issuedAt
    if (ageSeconds > 60 * 60 * 24) {
      response.cookies.set(SESSION_COOKIE, await signSession(session.coachId), sessionCookieOptions)
    }
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
