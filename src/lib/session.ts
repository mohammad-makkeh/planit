import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from './auth'

export async function getCoachId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function requireCoachId(): Promise<string> {
  const coachId = await getCoachId()
  if (!coachId) redirect('/login')
  return coachId
}
