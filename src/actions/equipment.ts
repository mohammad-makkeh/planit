'use server'

import { revalidatePath } from 'next/cache'
import { isUniqueViolation } from '@/db/client'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { equipmentSchema } from '@/lib/validation'
import {
  createEquipment, deleteEquipment, listEquipment, updateEquipment,
} from '@/services/equipment'

export async function listEquipmentAction(): Promise<ActionResult<{ id: string; name: string; imageUrl: string | null; moveCount: number }[]>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const items = await listEquipment(coachId)
    return ok(items.map(({ id, name, imageUrl, moveCount }) => ({ id, name, imageUrl, moveCount })))
  })
}

export async function createEquipmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = equipmentSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      const equip = await createEquipment(coachId, parsed.data)
      revalidatePath('/library')
      return ok({ id: equip.id })
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'An item with this name already exists.')
      throw e
    }
  })
}

export async function updateEquipmentAction(
  equipmentId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = equipmentSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      const updated = await updateEquipment(coachId, equipmentId, parsed.data)
      if (!updated) return err('not_found', 'Item not found.')
      revalidatePath('/library')
      return ok({ id: updated.id })
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'An item with this name already exists.')
      throw e
    }
  })
}

export async function deleteEquipmentAction(equipmentId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const result = await deleteEquipment(coachId, equipmentId)

    if (result === 'not_found') {
      return err('not_found', 'Item not found.')
    }
    if (result === 'fallback') {
      return err('validation', '"Any" is the fallback and can\'t be deleted.')
    }
    if (result === 'deleted') {
      revalidatePath('/library')
      return ok(null)
    }

    throw new Error(`Unknown delete result: ${result satisfies never}`)
  })
}
