import 'server-only'
import { and, asc, count, countDistinct, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { equipment, exerciseTags, exercises, planRows, planSessions, plans, tags } from '@/db/schema'
import type { ExerciseInput } from '@/lib/validation'

export type Exercise = typeof exercises.$inferSelect
export type ExerciseWithTags = Exercise & { tags: { id: string; name: string }[] }
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
  return rows.map((r) => ({ ...r, tags: byExercise.get(r.id) ?? [] }))
}

function toRow(input: ExerciseInput) {
  return {
    name: input.name,
    imageUrl: input.imageUrl ?? null,
    tutorialUrl: input.tutorialUrl ?? null,
  }
}

// Staging shim (Task 1): exercises.defaultEquipmentId is NOT NULL with no default, but
// ExerciseInput doesn't carry an equipment selection until Task 3. Default new exercises to
// the coach's fallback ("Any") equipment, mirroring the migration's backfill. Replaced by
// Task 3's real ownership-checked defaultEquipmentId handling.
async function fallbackEquipmentId(coachId: string): Promise<string> {
  const [fallback] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.coachId, coachId), eq(equipment.isFallback, true)))
  if (!fallback) throw new Error('Coach has no fallback equipment')
  return fallback.id
}

export async function createExercise(coachId: string, input: ExerciseInput): Promise<Exercise> {
  const defaultEquipmentId = await fallbackEquipmentId(coachId)
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(exercises)
      .values({ coachId, ...toRow(input), defaultEquipmentId })
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
    return created
  })
}

export async function updateExercise(
  coachId: string,
  exerciseId: string,
  input: ExerciseInput,
): Promise<Exercise | undefined> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(exercises)
      .set(toRow(input))
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
