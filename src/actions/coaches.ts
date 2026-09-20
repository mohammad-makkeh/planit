'use server'

import { revalidatePath } from 'next/cache'
import { isUniqueViolation } from '@/db/client'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { profileSchema } from '@/lib/validation'
import { updateCoachProfile } from '@/services/coaches'

export async function updateProfileAction(input: unknown): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      await updateCoachProfile(coachId, parsed.data)
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'That email is already in use.')
      throw e
    }
    revalidatePath('/settings')
    return ok(null)
  })
}
