'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { planDocumentSchema, planMetaSchema } from '@/lib/validation'
import {
  createPlan,
  duplicatePlan,
  generateShareSlug,
  getPlanForEditor,
  revokeShareSlug,
  savePlanDocument,
  softDeletePlan,
  updatePlanMeta,
  type EditorPlan,
} from '@/services/plans'

const uuid = z.string().uuid()

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

export async function savePlanDocumentAction(
  planId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const parsed = planDocumentSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const saved = await savePlanDocument(coachId, planId, parsed.data)
    if (!saved) return err('not_found', 'Plan not found.')
    revalidatePath(`/clients/${saved.clientId}`)
    return ok(null)
  })
}

