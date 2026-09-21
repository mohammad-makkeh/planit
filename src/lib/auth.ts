import { SignJWT, jwtVerify } from 'jose'

const SESSION_DURATION_S = 60 * 60 * 24 * 365 // 1 year, sliding (middleware re-issues)

export const SESSION_COOKIE = 'planit_session'

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_S,
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set and 32+ chars')
  return new TextEncoder().encode(s)
}

export async function signSession(coachId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(coachId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.sub ?? null
  } catch {
    return null
  }
}

export async function verifySessionWithAge(
  token: string,
): Promise<{ coachId: string; issuedAt: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload.sub || typeof payload.iat !== 'number') return null
    return { coachId: payload.sub, issuedAt: payload.iat }
  } catch {
    return null
  }
}
