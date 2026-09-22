import 'server-only'
import { and, asc, count, countDistinct, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  equipment, exerciseEquipment, exerciseTags, exercises, planRows, planSessions, plans, tags,
} from '@/db/schema'
import type { ExerciseInput } from '@/lib/validation'

export type Exercise = typeof exercises.$inferSelect
export type ExerciseWithTags = Exercise & {
  tags: { id: string; name: string }[]
  equipment: { id: string; name: string; imageUrl: string | null }[]
}
export type ExerciseUsage = { rowCount: number; planCount: number }

export async function listExercises(coachId: string): Promise<ExerciseWithTags[]> {
  const rows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.coachId, coachId))
    .orderBy(asc(exercises.name))
  if (rows.length === 0) return []

  const links = await db
    .select({ exerciseId: exerciseTags.exerciseId, id: tags.id, name: tags.name })
    .from(exerciseTags)
    .innerJoin(tags, eq(exerciseTags.tagId, tags.id))
    .where(and(eq(tags.coachId, coachId), inArray(exerciseTags.exerciseId, rows.map((r) => r.id))))

  const byExercise = new Map<string, { id: string; name: string }[]>()
  for (const link of links) {
    const list = byExercise.get(link.exerciseId) ?? []
    list.push({ id: link.id, name: link.name })
    byExercise.set(link.exerciseId, list)
  }

  const equipmentLinks = await db
    .select({
      exerciseId: exerciseEquipment.exerciseId,
      id: equipment.id,
      name: equipment.name,
      imageUrl: equipment.imageUrl,
    })
    .from(exerciseEquipment)
    .innerJoin(equipment, eq(exerciseEquipment.equipmentId, equipment.id))
    .where(and(eq(equipment.coachId, coachId), inArray(exerciseEquipment.exerciseId, rows.map((r) => r.id))))
    .orderBy(asc(equipment.name))

  const equipmentByExercise = new Map<string, { id: string; name: string; imageUrl: string | null }[]>()
  for (const link of equipmentLinks) {
    const list = equipmentByExercise.get(link.exerciseId) ?? []
    list.push({ id: link.id, name: link.name, imageUrl: link.imageUrl })
    equipmentByExercise.set(link.exerciseId, list)
  }

  return rows.map((r) => ({
    ...r,
    tags: byExercise.get(r.id) ?? [],
    equipment: equipmentByExercise.get(r.id) ?? [],
  }))
}

function toRow(input: ExerciseInput, defaultEquipmentId: string) {
  return {
    name: input.name,
    imageUrl: input.imageUrl ?? null,
    tutorialUrl: input.tutorialUrl ?? null,
    movementType: input.movementType,
    defaultEquipmentId,
  }
}

/**
 * Keeps the coach-owned ids in the order the coach picked them — the ownership query returns
 * rows in an arbitrary order, so the input drives the order, not the query result. The first
 * entry becomes the exercise's default equipment, which preserves the "default is always an
 * owned, linked equipment" guarantee now that the default is no longer a separate input.
 */
function orderedOwned(equipmentIds: string[], ownedRows: { id: string }[]): string[] {
  const owned = new Set(ownedRows.map((e) => e.id))
  return equipmentIds.filter((id) => owned.has(id))
}

export async function createExercise(coachId: string, input: ExerciseInput): Promise<Exercise> {
  return db.transaction(async (tx) => {
    const ownedEquipment = input.equipmentIds.length > 0
      ? orderedOwned(input.equipmentIds, await tx.select({ id: equipment.id }).from(equipment)
          .where(and(eq(equipment.coachId, coachId), inArray(equipment.id, input.equipmentIds))))
      : []
    const defaultEquipmentId = ownedEquipment[0]
    if (!defaultEquipmentId) throw new Error('Default equipment not owned')
    const [created] = await tx
      .insert(exercises)
      .values({ coachId, ...toRow(input, defaultEquipmentId) })
      .returning()
    if (!created) throw new Error('Insert returned no row')
    const ownedTagIds = input.tagIds.length > 0
      ? (await tx.select({ id: tags.id }).from(tags)
          .where(and(eq(tags.coachId, coachId), inArray(tags.id, input.tagIds)))).map((t) => t.id)
      : []
    if (ownedTagIds.length > 0) {
      await tx
        .insert(exerciseTags)
        .values(ownedTagIds.map((tagId) => ({ exerciseId: created.id, tagId })))
        .onConflictDoNothing()
    }
    if (ownedEquipment.length > 0) {
      await tx
        .insert(exerciseEquipment)
        .values(ownedEquipment.map((equipmentId) => ({ exerciseId: created.id, equipmentId })))
        .onConflictDoNothing()
    }
    return created
  })
}

export async function updateExercise(
  coachId: string,
  exerciseId: string,
  input: ExerciseInput,
): Promise<Exercise | undefined> {
  return db.transaction(async (tx) => {
    const ownedEquipment = input.equipmentIds.length > 0
      ? orderedOwned(input.equipmentIds, await tx.select({ id: equipment.id }).from(equipment)
          .where(and(eq(equipment.coachId, coachId), inArray(equipment.id, input.equipmentIds))))
      : []
    const defaultEquipmentId = ownedEquipment[0]
    if (!defaultEquipmentId) throw new Error('Default equipment not owned')
    const [updated] = await tx
      .update(exercises)
      .set(toRow(input, defaultEquipmentId))
      .where(and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)))
      .returning()
    if (!updated) return undefined
    await tx.delete(exerciseTags).where(eq(exerciseTags.exerciseId, exerciseId))
    const ownedTagIds = input.tagIds.length > 0
      ? (await tx.select({ id: tags.id }).from(tags)
          .where(and(eq(tags.coachId, coachId), inArray(tags.id, input.tagIds)))).map((t) => t.id)
      : []
    if (ownedTagIds.length > 0) {
      await tx
        .insert(exerciseTags)
        .values(ownedTagIds.map((tagId) => ({ exerciseId, tagId })))
        .onConflictDoNothing()
    }
    await tx.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, exerciseId))
    if (ownedEquipment.length > 0) {
      await tx
        .insert(exerciseEquipment)
        .values(ownedEquipment.map((equipmentId) => ({ exerciseId, equipmentId })))
        .onConflictDoNothing()
    }
    return updated
  })
}

export async function getExerciseUsage(coachId: string, exerciseId: string): Promise<ExerciseUsage> {
  const [usage] = await db
    .select({ rowCount: count(planRows.id), planCount: countDistinct(plans.id) })
    .from(planRows)
    .innerJoin(planSessions, eq(planRows.sessionId, planSessions.id))
    .innerJoin(plans, eq(planSessions.planId, plans.id))
    .where(and(eq(planRows.exerciseId, exerciseId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
  return usage ?? { rowCount: 0, planCount: 0 }
}

/** HARD delete — FK cascade removes exercise_tags links AND plan_rows (spec sync rule). */
export async function deleteExercise(coachId: string, exerciseId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)))
    .returning({ id: exercises.id })
  return deleted !== undefined
}
