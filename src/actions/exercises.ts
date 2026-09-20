'use server'

import { revalidatePath } from 'next/cache'
import { isUniqueViolation } from '@/db/client'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { exerciseSchema } from '@/lib/validation'
import {
  createExercise, deleteExercise, getExerciseUsage, updateExercise,
  type ExerciseUsage,
} from '@/services/exercises'

export async function createExerciseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = exerciseSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      const exercise = await createExercise(coachId, parsed.data)
      revalidatePath('/library')
      return ok({ id: exercise.id })
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'A move with this name already exists.')
      throw e
    }
  })
}

export async function updateExerciseAction(
  exerciseId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = exerciseSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      const updated = await updateExercise(coachId, exerciseId, parsed.data)
      if (!updated) return err('not_found', 'Move not found.')
      revalidatePath('/library')
      return ok({ id: updated.id })
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'A move with this name already exists.')
      throw e
    }
  })
}

export async function getExerciseUsageAction(
  exerciseId: string,
): Promise<ActionResult<ExerciseUsage>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    return ok(await getExerciseUsage(coachId, exerciseId))
  })
}

export async function deleteExerciseAction(exerciseId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const deleted = await deleteExercise(coachId, exerciseId)
    if (!deleted) return err('not_found', 'Move not found.')
    revalidatePath('/library')
    return ok(null)
  })
}
