'use server'

import { revalidatePath } from 'next/cache'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { warmupSchema } from '@/lib/validation'
import { createWarmup, deleteWarmup, updateWarmup } from '@/services/warmups'

export async function createWarmupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = warmupSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const warmup = await createWarmup(coachId, parsed.data.text)
    revalidatePath('/library')
    return ok({ id: warmup.id })
  })
}

export async function updateWarmupAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = warmupSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const updated = await updateWarmup(coachId, id, parsed.data.text)
    if (!updated) return err('not_found', 'Warm-up not found.')
    revalidatePath('/library')
    return ok({ id: updated.id })
  })
}

export async function deleteWarmupAction(id: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const deleted = await deleteWarmup(coachId, id)
    if (!deleted) return err('not_found', 'Warm-up not found.')
    revalidatePath('/library')
    return ok(null)
  })
}
