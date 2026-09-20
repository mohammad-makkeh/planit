'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'
import { loginSchema } from '@/lib/validation'
import { err, type ActionResult } from '@/lib/action-result'
import { findCoachByEmail } from '@/services/coaches'

export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return err('validation', 'Enter your email and password.')

  const coach = await findCoachByEmail(parsed.data.email)
  const valid = coach && (await verifyPassword(parsed.data.password, coach.passwordHash))
  if (!coach || !valid) return err('unauthorized', 'Wrong email or password.')

  const store = await cookies()
  store.set(SESSION_COOKIE, await signSession(coach.id), sessionCookieOptions)
  redirect('/')
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
