'use server'

import { revalidatePath } from 'next/cache'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { clientSchema } from '@/lib/validation'
import {
  createClient, softDeleteClient, updateClient,
} from '@/services/clients'

export async function createClientAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = clientSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const client = await createClient(coachId, parsed.data)
    revalidatePath('/')
    return ok({ id: client.id })
  })
}

export async function updateClientAction(
  clientId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = clientSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const updated = await updateClient(coachId, clientId, parsed.data)
    if (!updated) return err('not_found', 'Client not found.')
    revalidatePath('/')
    revalidatePath(`/clients/${clientId}`)
    return ok({ id: updated.id })
  })
}

export async function deleteClientAction(clientId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const deleted = await softDeleteClient(coachId, clientId)
    if (!deleted) return err('not_found', 'Client not found.')
    revalidatePath('/')
    return ok(null)
  })
}
