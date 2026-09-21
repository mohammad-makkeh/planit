'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { planMetaSchema, planPatchSchema } from '@/lib/validation'
import {
  applyPlanPatch,
  createPlan,
  createRow,
  createSession,
  deleteRow,
  deleteSession,
  duplicatePlan,
  duplicateRow,
  duplicateSession,
  generateShareSlug,
  getPlanForEditor,
  reorderRows,
  reorderSessions,
  revokeShareSlug,
  softDeletePlan,
  swapRowExercise,
  updatePlanMeta,
  type EditorPlan,
} from '@/services/plans'

const uuid = z.string().uuid()
const uuidList = z.array(uuid).min(1).max(200)

function isUuid(value: string): boolean {
  return uuid.safeParse(value).success
}

/** Fetch the fresh payload after a structural mutation and revalidate the profile. */
async function freshPayload(coachId: string, planId: string): Promise<ActionResult<EditorPlan>> {
  const payload = await getPlanForEditor(coachId, planId)
  if (!payload) return err('not_found', 'Plan not found.')
  revalidatePath(`/clients/${payload.clientId}`)
  return ok(payload)
}

export async function createPlanAction(clientId: string): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(clientId)) return err('validation', 'Invalid id.')
    const created = await createPlan(coachId, clientId)
    if (!created) return err('not_found', 'Client not found.')
    revalidatePath(`/clients/${clientId}`)
    return ok(created)
  })
}

export async function duplicatePlanAction(
  planId: string,
  targetClientId?: string,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || (targetClientId !== undefined && !isUuid(targetClientId))) {
      return err('validation', 'Invalid id.')
    }
    const created = await duplicatePlan(coachId, planId, targetClientId)
    if (!created) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok(created)
  })
}

export async function deletePlanAction(planId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const deleted = await softDeletePlan(coachId, planId)
    if (!deleted) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok(null)
  })
}

export async function updatePlanMetaAction(
  planId: string,
  input: unknown,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const parsed = planMetaSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const updated = await updatePlanMeta(coachId, planId, parsed.data)
    if (!updated) return err('not_found', 'Plan not found.')
    return freshPayload(coachId, planId)
  })
}

export async function generateShareSlugAction(
  planId: string,
): Promise<ActionResult<{ slug: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const slug = await generateShareSlug(coachId, planId)
    if (!slug) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok({ slug })
  })
}

export async function revokeShareSlugAction(planId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const revoked = await revokeShareSlug(coachId, planId)
    if (!revoked) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok(null)
  })
}

export async function applyPlanPatchAction(
  planId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const parsed = planPatchSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const applied = await applyPlanPatch(coachId, planId, parsed.data)
    if (!applied) return err('not_found', 'Plan not found.')
    return ok(null)
  })
}

export async function createSessionAction(planId: string): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const done = await createSession(coachId, planId)
    if (!done) return err('not_found', 'Plan not found.')
    return freshPayload(coachId, planId)
  })
}

export async function duplicateSessionAction(
  planId: string,
  sessionId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId)) return err('validation', 'Invalid id.')
    const done = await duplicateSession(coachId, sessionId)
    if (!done) return err('not_found', 'Session not found.')
    return freshPayload(coachId, planId)
  })
}

export async function deleteSessionAction(
  planId: string,
  sessionId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId)) return err('validation', 'Invalid id.')
    const done = await deleteSession(coachId, sessionId)
    if (!done) return err('not_found', 'Session not found.')
    return freshPayload(coachId, planId)
  })
}

export async function reorderSessionsAction(
  planId: string,
  orderedIds: string[],
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !uuidList.safeParse(orderedIds).success) {
      return err('validation', 'Invalid ids.')
    }
    const done = await reorderSessions(coachId, planId, orderedIds)
    if (!done) return err('not_found', 'Plan not found.')
    return freshPayload(coachId, planId)
  })
}

export async function createRowAction(
  planId: string,
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId) || !isUuid(exerciseId)) {
      return err('validation', 'Invalid id.')
    }
    const done = await createRow(coachId, sessionId, exerciseId)
    if (!done) return err('not_found', 'Session or move not found.')
    return freshPayload(coachId, planId)
  })
}

export async function swapRowExerciseAction(
  planId: string,
  rowId: string,
  exerciseId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(rowId) || !isUuid(exerciseId)) {
      return err('validation', 'Invalid id.')
    }
    const done = await swapRowExercise(coachId, rowId, exerciseId)
    if (!done) return err('not_found', 'Row or move not found.')
    return freshPayload(coachId, planId)
  })
}

export async function duplicateRowAction(
  planId: string,
  rowId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(rowId)) return err('validation', 'Invalid id.')
    const done = await duplicateRow(coachId, rowId)
    if (!done) return err('not_found', 'Row not found.')
    return freshPayload(coachId, planId)
  })
}

export async function deleteRowAction(
  planId: string,
  rowId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(rowId)) return err('validation', 'Invalid id.')
    const done = await deleteRow(coachId, rowId)
    if (!done) return err('not_found', 'Row not found.')
    return freshPayload(coachId, planId)
  })
}

export async function reorderRowsAction(
  planId: string,
  sessionId: string,
  orderedIds: string[],
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId) || !uuidList.safeParse(orderedIds).success) {
      return err('validation', 'Invalid ids.')
    }
    const done = await reorderRows(coachId, sessionId, orderedIds)
    if (!done) return err('not_found', 'Session not found.')
    return freshPayload(coachId, planId)
  })
}
