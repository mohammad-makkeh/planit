import 'server-only'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import { equipment, exerciseEquipment, exercises } from '@/db/schema'
import type { EquipmentInput } from '@/lib/validation'

export type Equipment = typeof equipment.$inferSelect
export type EquipmentWithUsage = Equipment & { moveCount: number }

export async function listEquipment(coachId: string): Promise<EquipmentWithUsage[]> {
  const rows = await db
    .select({
      id: equipment.id,
      coachId: equipment.coachId,
      name: equipment.name,
      imageUrl: equipment.imageUrl,
      isFallback: equipment.isFallback,
      createdAt: equipment.createdAt,
      moveCount: count(exerciseEquipment.exerciseId),
    })
    .from(equipment)
    .leftJoin(exerciseEquipment, eq(exerciseEquipment.equipmentId, equipment.id))
    .where(eq(equipment.coachId, coachId))
    .groupBy(equipment.id)
    .orderBy(asc(equipment.name))
  return rows
}

export async function createEquipment(coachId: string, input: EquipmentInput): Promise<Equipment> {
  const [created] = await db
    .insert(equipment)
    .values({ coachId, name: input.name, imageUrl: input.imageUrl ?? null })
    .returning()
  if (!created) throw new Error('Insert returned no row')
  return created
}

export async function updateEquipment(
  coachId: string,
  equipmentId: string,
  input: EquipmentInput,
): Promise<Equipment | undefined> {
  const [updated] = await db
    .update(equipment)
    .set({ name: input.name, imageUrl: input.imageUrl ?? null })
    .where(and(eq(equipment.id, equipmentId), eq(equipment.coachId, coachId)))
    .returning()
  return updated
}

export type DeleteEquipmentResult = 'deleted' | 'not_found' | 'fallback'

/**
 * Aggressive sync (spec): moves defaulting to it get their first other linked
 * equipment, else the coach's fallback ("Any", also re-linked); junction rows
 * cascade; plan rows revert to NULL (inherit) via FK. "Any" is undeletable.
 */
export async function deleteEquipment(coachId: string, equipmentId: string): Promise<DeleteEquipmentResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.coachId, coachId)))
    if (!target) return 'not_found'
    if (target.isFallback) return 'fallback'

    const affected = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.coachId, coachId), eq(exercises.defaultEquipmentId, equipmentId)))

    if (affected.length > 0) {
      const [fallback] = await tx
        .select({ id: equipment.id })
        .from(equipment)
        .where(and(eq(equipment.coachId, coachId), eq(equipment.isFallback, true)))
      if (!fallback) throw new Error('Coach has no fallback equipment')
      for (const move of affected) {
        const [other] = await tx
          .select({ equipmentId: exerciseEquipment.equipmentId })
          .from(exerciseEquipment)
          .where(and(
            eq(exerciseEquipment.exerciseId, move.id),
            ne(exerciseEquipment.equipmentId, equipmentId),
          ))
          .limit(1)
        const newDefault = other?.equipmentId ?? fallback.id
        if (!other) {
          await tx
            .insert(exerciseEquipment)
            .values({ exerciseId: move.id, equipmentId: fallback.id })
            .onConflictDoNothing()
        }
        await tx.update(exercises).set({ defaultEquipmentId: newDefault }).where(eq(exercises.id, move.id))
      }
    }

    await tx.delete(equipment).where(eq(equipment.id, equipmentId))
    return 'deleted'
  })
}
