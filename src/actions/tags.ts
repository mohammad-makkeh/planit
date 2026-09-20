'use server'

import { revalidatePath } from 'next/cache'
import { fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { tagSchema } from '@/lib/validation'
import { createTag } from '@/services/tags'

export async function createTagAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = tagSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const tag = await createTag(coachId, parsed.data.name)
    revalidatePath('/library')
    return ok({ id: tag.id, name: tag.name })
  })
}
